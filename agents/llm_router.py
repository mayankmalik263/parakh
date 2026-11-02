"""
Single entry point for every LLM call in Parakh. BharatCode only.

BharatCode (https://bharatcode.ai) serves an OpenAI-compatible API, so this uses the official
openai SDK pointed at BharatCode's base URL. Nothing outside this file knows which provider runs.

Models per role:
  - PARAKH_MODEL (default qwen-3.8-27b) runs every role. The student tier serves this one model.
  - PARAKH_CRITIC_MODEL, if set, gives the Critic a different model so it isn't grading output from
    its own model. If that model fails or is out of quota, the Critic falls back to PARAKH_MODEL.
"""
import json
import logging
import os
import random
import re
import time
from contextlib import contextmanager
from contextvars import ContextVar
from typing import TypeVar

from dotenv import load_dotenv
from openai import APIConnectionError, APIStatusError, OpenAI
from pydantic import BaseModel, ValidationError

load_dotenv(override=True)

logger = logging.getLogger(__name__)

BASE_URL = os.getenv("BHARATCODE_BASE_URL", "https://bharatcode.ai/api/model/v1").rstrip("/")
MODEL = os.getenv("PARAKH_MODEL", "qwen-3.8-27b")
CRITIC_MODEL = os.getenv("PARAKH_CRITIC_MODEL") or MODEL

# Reads pitch-deck images. Set PARAKH_VISION_MODEL if your tier serves a separate vision model.
VISION_MODEL = os.getenv("PARAKH_VISION_MODEL") or MODEL

ROLE_MODELS = {role: MODEL for role in ("strategist", "builder", "economics", "growth", "chat", "clarify", "utility")}
ROLE_MODELS["critic"] = CRITIC_MODEL
ROLE_MODELS["vision"] = VISION_MODEL

# Next models to try when one fails. Only a separately configured model has somewhere to fall back to.
FALLBACK = {m: [MODEL] for m in (CRITIC_MODEL, VISION_MODEL) if m != MODEL}

# Ask for response_format={"type": "json_object"} on JSON calls. Set BHARATCODE_JSON_MODE=0 if the
# API rejects it: _extract_json still pulls the object out of a plain-text reply.
JSON_MODE = os.getenv("BHARATCODE_JSON_MODE", "1") != "0"

# Qwen 3.x "thinks" before answering by default. On BharatCode those thinking tokens count against
# max_tokens and the daily quota, and a long think can use the whole budget and leave the answer
# empty. Parakh's agents get their reasoning steps in the prompt, so thinking is off unless
# PARAKH_THINKING=1. It is switched off with chat_template_kwargs (vLLM / SGLang style); if
# BharatCode rejects that field, Parakh drops it for the rest of the process.
THINKING = os.getenv("PARAKH_THINKING", "0") == "1"
_send_no_think = not THINKING
NO_THINK_BODY = {"chat_template_kwargs": {"enable_thinking": False}}
# One retry gets a bigger budget when a reply comes back empty because thinking used it all up.
MAX_TOKENS_CAP = 8000

# Standard OpenAI sampling parameters only. Provider-specific ones (Groq's reasoning_effort,
# reasoning_format) are rejected with a 400 by APIs that don't know them.
SAMPLING = {"temperature": 0.7, "top_p": 0.8}

# Statuses worth waiting out: 429 = key over its rate limit, 5xx = server busy or queue full.
RETRYABLE_STATUS = {429, 500, 502, 503, 504}
MAX_ATTEMPTS = 5
BACKOFF_BASE_S = 2.0
# A Retry-After longer than this means a daily quota, not a busy server: stop waiting.
MAX_WAIT_S = 60
TIMEOUT_S = float(os.getenv("BHARATCODE_TIMEOUT_S", "180"))

T = TypeVar("T", bound=BaseModel)

_client: OpenAI | None = None

# A visitor's own BharatCode key for the current request (header X-BharatCode-Key). Calls made
# while it is set use the visitor's quota instead of the server's. Never stored or logged.
_user_key: ContextVar[str | None] = ContextVar("bharatcode_user_key", default=None)


# Collects token usage for one simulation so the backend can print a total at the end.
_meter: ContextVar[list | None] = ContextVar("parakh_token_meter", default=None)


@contextmanager
def token_meter():
    """with token_meter() as calls: ... then sum(c['total'] for c in calls)."""
    calls: list = []
    token = _meter.set(calls)
    try:
        yield calls
    finally:
        _meter.reset(token)


def summarize_usage(calls: list) -> str:
    inp = sum(c["in"] for c in calls)
    out = sum(c["out"] for c in calls)
    think = sum(c["thinking"] for c in calls)
    return f"{len(calls)} calls, {inp + out:,} tokens ({inp:,} in, {out:,} out, of which {think:,} thinking)"


@contextmanager
def use_bharatcode_key(key: str | None):
    token = _user_key.set((key or "").strip() or None)
    try:
        yield
    finally:
        _user_key.reset(token)


def _get_client() -> OpenAI:
    global _client
    if _user_key.get():
        return OpenAI(api_key=_user_key.get(), base_url=BASE_URL, max_retries=0, timeout=TIMEOUT_S)
    if _client is None:
        key = (os.environ.get("BHARATCODE_API_KEY") or "").strip().strip('"').strip("'")
        if not key:
            raise RuntimeError("BHARATCODE_API_KEY is not set. Add it to .env.")
        _client = OpenAI(api_key=key, base_url=BASE_URL, max_retries=0, timeout=TIMEOUT_S)
    return _client


def _wait_seconds(err: Exception, attempt: int) -> float:
    """Retry-After if the server sent one, else exponential backoff with jitter: ~2s, 4s, 8s, 16s."""
    response = getattr(err, "response", None)
    header = response.headers.get("retry-after") if response is not None else None
    if header:
        try:
            return float(header) + 0.5
        except ValueError:
            pass  # an HTTP date instead of seconds: fall back to backoff
    return BACKOFF_BASE_S * 2 ** attempt + random.uniform(0, 1)


_THINK = re.compile(r"<think>.*?</think>", re.DOTALL)


def _strip_thinking(text: str) -> str:
    """Qwen 3.x can put its reasoning in <think>...</think> before the answer. Drop it, including a
    <think> block that never closed because the reply ran out of tokens mid-thought."""
    text = _THINK.sub("", text)
    if "<think>" in text:
        text = text.split("<think>", 1)[0]
    return text.strip()


def _record_usage(resp, role: str, model: str, seconds: float, finish: str | None) -> None:
    usage = getattr(resp, "usage", None)
    if not usage:
        return
    details = getattr(usage, "completion_tokens_details", None)
    thinking = (getattr(details, "reasoning_tokens", None) or 0) if details else 0
    if not thinking and resp.choices:
        # BharatCode returns the thinking as text in reasoning_content without counting it separately.
        msg = resp.choices[0].message
        reasoning = getattr(msg, "reasoning_content", None) or getattr(msg, "reasoning", None) or ""
        thinking = round(len(reasoning) / 3.5)  # rough: ~3.5 characters per token
    entry = {"role": role, "in": usage.prompt_tokens or 0, "out": usage.completion_tokens or 0, "thinking": thinking}
    entry["total"] = entry["in"] + entry["out"]
    calls = _meter.get()
    if calls is not None:
        calls.append(entry)
    think = f", {thinking} thinking" if thinking else ""
    print(f"[LLM] {role:<10} {model}  in={entry['in']} out={entry['out']}{think}  finish={finish}  {seconds:.1f}s")


def _extract_json(text: str) -> str:
    """The JSON object in a reply, without markdown fences or chatter around it."""
    text = text.strip()
    if text.startswith("{"):
        # BharatCode's Qwen sometimes appends a stray word after the closing brace ("...]}parameter").
        # Cut after the last brace instead of asking the model again.
        end = text.rfind("}")
        return text[:end + 1] if end != -1 else text
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if fenced:
        return fenced.group(1)
    start, end = text.find("{"), text.rfind("}")
    return text[start:end + 1] if start != -1 and end > start else text


class EmptyReplyError(RuntimeError):
    """The model answered with no text after its thinking was removed."""


def _complete(model: str, messages: list[dict], json_mode: bool, max_tokens: int, role: str) -> str:
    global _send_no_think
    client = _get_client()
    kwargs = {"model": model, "messages": messages, "max_tokens": max_tokens, **SAMPLING}
    if json_mode and JSON_MODE:
        kwargs["response_format"] = {"type": "json_object"}

    attempt = 0
    empty_retry_done = False
    while attempt < MAX_ATTEMPTS:
        if _send_no_think:
            kwargs["extra_body"] = NO_THINK_BODY
        else:
            kwargs.pop("extra_body", None)
        started = time.monotonic()
        try:
            resp = client.chat.completions.create(**kwargs)
        except (APIStatusError, APIConnectionError) as e:
            status = getattr(e, "status_code", None)  # None for connection errors and timeouts
            if status == 400 and "extra_body" in kwargs:
                # BharatCode may not accept chat_template_kwargs. Stop sending it and retry at once.
                logger.warning("BharatCode rejected chat_template_kwargs (%s); sending requests without it.", e)
                print("[LLM] BharatCode doesn't accept the 'thinking off' switch; continuing without it.")
                _send_no_think = False
                continue
            if status is not None and status not in RETRYABLE_STATUS:
                raise
            wait = _wait_seconds(e, attempt)
            if wait > MAX_WAIT_S or attempt == MAX_ATTEMPTS - 1:
                raise
            logger.warning("%s answered %s, retrying in %.1fs (attempt %d of %d)", model, status or "no response", wait, attempt + 1, MAX_ATTEMPTS)
            time.sleep(wait)
            attempt += 1
            continue

        choice = resp.choices[0] if resp.choices else None
        finish = getattr(choice, "finish_reason", None) if choice else None
        _record_usage(resp, role, model, time.monotonic() - started, finish)
        content = _strip_thinking((choice.message.content if choice else None) or "")
        if content:
            return content

        # Empty answer. Almost always: the model spent max_tokens thinking (finish_reason "length").
        if not empty_retry_done:
            empty_retry_done = True
            kwargs["max_tokens"] = min(MAX_TOKENS_CAP, max(kwargs["max_tokens"] * 2, 4000))
            last = dict(kwargs["messages"][-1])
            if isinstance(last.get("content"), str) and "/no_think" not in last["content"]:
                # Qwen 3's own switch for "answer without thinking". Models that don't know it ignore it.
                last["content"] += "\n\n/no_think"
                kwargs["messages"] = [*kwargs["messages"][:-1], last]
            print(f"[LLM] {role}: empty reply (finish={finish}). Retrying once with max_tokens={kwargs['max_tokens']}.")
            continue
        raise EmptyReplyError(
            f"The {role} agent got no answer from {model} (finish_reason={finish}). "
            "It most likely spent its whole token budget thinking. Try again; if it keeps happening, tell us."
        )
    raise AssertionError("unreachable")


class BharatCodeAccessError(RuntimeError):
    """The key works but isn't allowed to use the model (BharatCode answers 402 or 403). Retrying won't help."""


def _complete_with_fallback(role: str, messages: list[dict], json_mode: bool, max_tokens: int) -> str:
    primary = ROLE_MODELS.get(role, MODEL)
    chain = [primary, *FALLBACK.get(primary, [])]
    for model in chain:
        try:
            return _complete(model, messages, json_mode, max_tokens, role)
        except (APIStatusError, APIConnectionError) as e:
            status = getattr(e, "status_code", None)
            # 400 is a bad request or a bad generation, not a dead model: let the caller retry.
            if status == 400:
                raise
            if status == 401:
                if _user_key.get():
                    raise RuntimeError("Your BharatCode API key was rejected. Check it, or remove it to use the shared quota.") from e
                raise RuntimeError("The server's BHARATCODE_API_KEY was rejected. Check .env.") from e
            if model != chain[-1]:
                logger.warning("%s failed (%s). Falling back for role '%s'.", model, status or e, role)
                continue
            if status in (402, 403):
                whose = "Your BharatCode key" if _user_key.get() else "The server's BharatCode key"
                raise BharatCodeAccessError(
                    f"{whose} can't use {model} yet. Students get it free after verifying their college email at "
                    "https://bharatcode.ai/account. Otherwise it needs a BharatCode Lite or Pro plan."
                ) from e
            if status == 429:
                whose = "Your BharatCode key's" if _user_key.get() else "Today's shared"
                raise RuntimeError(f"{whose} AI quota is used up. Try again later, or add your own BharatCode API key.") from e
            if status is None or status >= 500:
                raise RuntimeError("BharatCode is busy and didn't answer after several retries. Try again in a minute.") from e
            raise


def _shape(node: dict, defs: dict) -> str:
    """A JSON Schema node as a short template: {"name": string, "tags": [string] (1-3), ...}."""
    if "$ref" in node:
        return _shape(defs[node["$ref"].split("/")[-1]], defs)
    if "enum" in node:
        return "|".join(json.dumps(v) for v in node["enum"])
    if "const" in node:
        return json.dumps(node["const"])
    if "anyOf" in node:
        return " | ".join(_shape(n, defs) for n in node["anyOf"])
    kind = node.get("type")
    if kind == "object" or "properties" in node:
        required = set(node.get("required", []))
        props = list(node.get("properties", {}).items())
        lines = []
        for n, (name, sub) in enumerate(props):
            comma = "," if n < len(props) - 1 else ""
            note = f" // {sub['description']}" if sub.get("description") else ""
            optional = "" if name in required else "?"
            lines.append(f'"{name}"{optional}: {_shape(sub, defs)}{comma}{note}')
        return "{\n" + "\n".join(lines) + "\n}"
    if kind == "array":
        lo, hi = node.get("minItems"), node.get("maxItems")
        count = f" ({lo}-{hi} items)" if lo is not None and hi is not None and lo != hi else (f" (exactly {lo})" if lo is not None and lo == hi else (f" (at least {lo})" if lo else ""))
        return f"[{_shape(node.get('items', {}), defs)}]{count}"
    if kind == "null":
        return "null"
    return {"string": "string", "number": "number", "integer": "integer", "boolean": "true|false"}.get(kind, "any")


def _schema_hint(schema: type[BaseModel]) -> str:
    """A compact template of the expected JSON. About half the size of the raw JSON Schema; descriptions
    and list sizes are kept because the agents need them."""
    js = schema.model_json_schema()
    return _shape(js, js.get("$defs", {}))


def call_llm(
    prompt: str,
    role: str = "utility",
    system: str | None = None,
    max_tokens: int = 3000,
):
    """Plain-text call. Returns the model's reply as a string."""
    messages = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": prompt}]
    return _complete_with_fallback(role, messages, json_mode=False, max_tokens=max_tokens)


def call_llm_json(
    prompt: str,
    schema: type[T],
    role: str = "utility",
    system: str | None = None,
    max_tokens: int = 3000,
    images: list[str] | None = None,
) -> T:
    """
    JSON call validated against a Pydantic model. On invalid output, retries once
    with the validation errors fed back to the model.

    images: data URLs (data:image/png;base64,...) sent with the prompt in the OpenAI
    vision message format, for models that accept image input.
    """
    user = (f"{prompt}\n\nRespond with ONLY a JSON object in this shape (? marks an optional field, // explains a field):\n{_schema_hint(schema)}\n"
            "Each field holds the final answer only, never your working or self-checks.")
    content = [{"type": "text", "text": user}, *({"type": "image_url", "image_url": {"url": url}} for url in images)] if images else user
    messages = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": content}]

    last_error: Exception | None = None
    for attempt in (1, 2):
        try:
            raw = _complete_with_fallback(role, messages, json_mode=True, max_tokens=max_tokens)
            return schema.model_validate_json(_extract_json(raw))
        except ValidationError as e:
            last_error = e
            logger.warning("[%s] JSON failed validation (attempt %d): %s", role, attempt, e.errors()[:3])
            messages = messages + [
                {"role": "assistant", "content": raw},
                {"role": "user", "content": f"That JSON failed validation:\n{e}\nReturn the corrected JSON object only."},
            ]
        except APIStatusError as e:
            if e.status_code != 400:
                raise
            last_error = e
            logger.warning("[%s] BharatCode rejected the request (attempt %d): %s", role, attempt, e)
    hint = " If BharatCode rejects response_format, set BHARATCODE_JSON_MODE=0 in .env." if "response_format" in str(last_error) else ""
    raise RuntimeError(f"[{role}] could not produce valid JSON: {last_error}{hint}")
