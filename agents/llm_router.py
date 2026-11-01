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

ROLE_MODELS = {role: MODEL for role in ("strategist", "builder", "economics", "growth", "chat", "clarify", "utility")}
ROLE_MODELS["critic"] = CRITIC_MODEL

# Next models to try when one fails. Only a separate Critic model has somewhere to fall back to.
FALLBACK = {CRITIC_MODEL: [MODEL]} if CRITIC_MODEL != MODEL else {}

# Ask for response_format={"type": "json_object"} on JSON calls. Set BHARATCODE_JSON_MODE=0 if the
# API rejects it: _extract_json still pulls the object out of a plain-text reply.
JSON_MODE = os.getenv("BHARATCODE_JSON_MODE", "1") != "0"

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
    """Qwen 3.x can put its reasoning in <think>...</think> before the answer. Drop it."""
    return _THINK.sub("", text).strip()


def _extract_json(text: str) -> str:
    """The JSON object in a reply, without markdown fences or chatter around it."""
    text = text.strip()
    if text.startswith("{"):
        return text
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
    if fenced:
        return fenced.group(1)
    start, end = text.find("{"), text.rfind("}")
    return text[start:end + 1] if start != -1 and end > start else text


def _complete(model: str, messages: list[dict], json_mode: bool, max_tokens: int, role: str) -> str:
    client = _get_client()
    kwargs = {"model": model, "messages": messages, "max_tokens": max_tokens, **SAMPLING}
    if json_mode and JSON_MODE:
        kwargs["response_format"] = {"type": "json_object"}

    for attempt in range(MAX_ATTEMPTS):
        try:
            resp = client.chat.completions.create(**kwargs)
            if resp.usage:
                logger.info("usage role=%s model=%s in=%d out=%d", role, model, resp.usage.prompt_tokens, resp.usage.completion_tokens)
            content = _strip_thinking(resp.choices[0].message.content or "")
            if not content:
                raise RuntimeError(f"{model} returned an empty response")
            return content
        except (APIStatusError, APIConnectionError) as e:
            status = getattr(e, "status_code", None)  # None for connection errors and timeouts
            if status is not None and status not in RETRYABLE_STATUS:
                raise
            wait = _wait_seconds(e, attempt)
            if wait > MAX_WAIT_S or attempt == MAX_ATTEMPTS - 1:
                raise
            logger.warning("%s answered %s, retrying in %.1fs (attempt %d of %d)", model, status or "no response", wait, attempt + 1, MAX_ATTEMPTS)
            time.sleep(wait)
    raise AssertionError("unreachable")


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
            if status == 429:
                whose = "Your BharatCode key's" if _user_key.get() else "Today's shared"
                raise RuntimeError(f"{whose} AI quota is used up. Try again later, or add your own BharatCode API key.") from e
            if status is None or status >= 500:
                raise RuntimeError("BharatCode is busy and didn't answer after several retries. Try again in a minute.") from e
            raise


def _strip_titles(node):
    if isinstance(node, dict):
        return {k: _strip_titles(v) for k, v in node.items() if not (k == "title" and isinstance(v, str))}
    if isinstance(node, list):
        return [_strip_titles(v) for v in node]
    return node


def _schema_hint(schema: type[BaseModel]) -> str:
    # Titles repeat the field names: dropping them cuts the hint by about a quarter.
    return json.dumps(_strip_titles(schema.model_json_schema()), separators=(",", ":"))


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
) -> T:
    """
    JSON call validated against a Pydantic model. On invalid output, retries once
    with the validation errors fed back to the model.
    """
    user = f"{prompt}\n\nRespond with ONLY a JSON object matching this JSON Schema:\n{_schema_hint(schema)}"
    messages = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": user}]

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
