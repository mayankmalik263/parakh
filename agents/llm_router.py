"""
Single entry point for every LLM call in MASS. Groq only.

Models per role (mixed on purpose, so the Critic isn't grading its own model):
  - Qwen 3.8 27B   -> judging: critic (+ economics on GROQ_TIER=dev)
  - GPT-OSS 120B   -> plan agents: strategist, builder, growth, chat (+ economics on the free tier)
  - GPT-OSS 20B    -> cheap mechanical calls: clarify, utility
"""
import json
import logging
import os
import re
import time
from contextlib import contextmanager
from contextvars import ContextVar
from typing import TypeVar

from dotenv import load_dotenv
from groq import APIConnectionError, APIStatusError, Groq, RateLimitError
from pydantic import BaseModel, ValidationError

load_dotenv(override=True)

logger = logging.getLogger(__name__)

QWEN = "qwen/qwen3.8-27b"
OSS_120B = "openai/gpt-oss-120b"
OSS_20B = "openai/gpt-oss-20b"

# Groq free tier caps Qwen at 1,000 OUTPUT tokens/min (reasoning tokens included) on top of
# 8K tokens/min per model. An Economics slice alone is ~1K tokens of JSON, so on the free tier
# Qwen only runs the Critic (short output, instruct mode). GROQ_TIER=dev moves Economics to Qwen.
GROQ_TIER = os.getenv("GROQ_TIER", "free").lower()
QWEN_FREE_MAX_OUTPUT = 1000

ROLE_MODELS = {
    "strategist": OSS_120B,
    "builder": OSS_120B,
    "growth": OSS_120B,
    "chat": OSS_120B,
    "economics": OSS_120B if GROQ_TIER == "free" else QWEN,
    "critic": QWEN,
    "clarify": OSS_20B,
    "utility": OSS_20B,
}

# Next models to try when one fails or is out of quota. On the free tier every model has its own
# 200K tokens/day, so falling back to 20B keeps the app working after 120B's daily budget is spent.
# Qwen is also a Preview model on Groq and can be pulled at short notice.
FALLBACK = {QWEN: [OSS_120B, OSS_20B], OSS_120B: [OSS_20B]}

# none = instruct mode (no hidden reasoning). Only worth raising on the dev tier.
QWEN_EFFORT = os.getenv("MASS_QWEN_EFFORT", "none" if GROQ_TIER == "free" else "medium")

# GPT-OSS reasoning tokens count against the per-minute budget. Code checks and fixes the
# arithmetic, so the number-crunching roles don't need medium reasoning.
ROLE_EFFORT = {"economics": "low", "growth": "low", "clarify": "low", "utility": "low"}

MAX_RATE_LIMIT_WAITS = 5
# Longer than this means a daily (or hourly) quota, not a per-minute one: move to the next model.
MAX_WAIT_S = 60

T = TypeVar("T", bound=BaseModel)

_client: Groq | None = None

# A visitor's own Groq key for the current request (header X-Groq-Key). Calls made while it is set
# use the visitor's free quota instead of the server's. Never stored or logged.
_user_key: ContextVar[str | None] = ContextVar("groq_user_key", default=None)


@contextmanager
def use_groq_key(key: str | None):
    token = _user_key.set((key or "").strip() or None)
    try:
        yield
    finally:
        _user_key.reset(token)


def _get_client() -> Groq:
    global _client
    if _user_key.get():
        return Groq(api_key=_user_key.get(), max_retries=0)
    if _client is None:
        key = (os.environ.get("GROQ_API_KEY") or "").strip().strip('"').strip("'")
        if not key:
            raise RuntimeError("GROQ_API_KEY is not set. Add it to .env.")
        _client = Groq(api_key=key, max_retries=0)
    return _client


def _model_params(model: str, role: str) -> dict:
    if model == QWEN:
        # Groq's recommended settings for Qwen 3.8 per mode.
        if QWEN_EFFORT == "none":
            return {"reasoning_effort": "none", "temperature": 0.7, "top_p": 0.8, "presence_penalty": 1.5}
        return {"reasoning_format": "hidden", "reasoning_effort": QWEN_EFFORT, "temperature": 1.0, "top_p": 0.95}
    return {"reasoning_effort": ROLE_EFFORT.get(role, "medium")}


def _retry_after(err: RateLimitError) -> float:
    header = err.response.headers.get("retry-after") if err.response is not None else None
    if header:
        try:
            return float(header) + 0.5
        except ValueError:
            pass
    match = re.search(r"try again in (?:(\d+)m)?([\d.]+)s", str(err))
    if match:
        return int(match.group(1) or 0) * 60 + float(match.group(2)) + 0.5
    return 15.0


def _complete(model: str, messages: list[dict], json_mode: bool, max_tokens: int, role: str) -> str:
    client = _get_client()
    if model == QWEN and GROQ_TIER == "free":
        max_tokens = min(max_tokens, QWEN_FREE_MAX_OUTPUT)
    kwargs = {"model": model, "messages": messages, "max_tokens": max_tokens, **_model_params(model, role)}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    for _ in range(MAX_RATE_LIMIT_WAITS):
        try:
            resp = client.chat.completions.create(**kwargs)
            content = resp.choices[0].message.content
            if resp.usage:
                logger.info("usage role=%s model=%s in=%d out=%d", role, model, resp.usage.prompt_tokens, resp.usage.completion_tokens)
            if not content:
                raise RuntimeError(f"{model} returned an empty response")
            return content
        except RateLimitError as e:
            # "Request too large" for the tier, or a daily quota: waiting won't help, let the caller fall back.
            if e.response is not None and e.response.headers.get("x-should-retry") == "false":
                raise
            wait = _retry_after(e)
            if wait > MAX_WAIT_S or "per day" in str(e):
                raise
            logger.warning("Rate limited on %s, waiting %.1fs", model, wait)
            time.sleep(wait)
    raise RuntimeError(f"{model} still rate limited after {MAX_RATE_LIMIT_WAITS} waits")


def _complete_with_fallback(role: str, messages: list[dict], json_mode: bool, max_tokens: int) -> str:
    primary = ROLE_MODELS.get(role, OSS_20B)
    chain = [primary, *FALLBACK.get(primary, [])]
    waits = []
    for model in chain:
        try:
            return _complete(model, messages, json_mode, max_tokens, role)
        except (APIStatusError, APIConnectionError) as e:
            # 400 json_validate_failed is a bad generation, not a dead model: let the caller retry.
            if getattr(e, "status_code", None) == 400:
                raise
            if getattr(e, "status_code", None) == 401 and _user_key.get():
                raise RuntimeError("Your Groq API key was rejected. Check it, or remove it to use the shared quota.") from e
            if isinstance(e, RateLimitError):
                waits.append(_retry_after(e))
            if model == chain[-1]:
                if len(waits) == len(chain):
                    minutes = max(1, round(min(waits) / 60))
                    whose = "Your Groq key's" if _user_key.get() else "Today's shared"
                    raise RuntimeError(
                        f"{whose} free AI quota is used up. Try again in about {minutes} minute(s), "
                        "or add your own free Groq API key.") from e
                raise
            logger.warning("%s failed (%s). Falling back for role '%s'.", model, getattr(e, "status_code", e), role)


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
            return schema.model_validate_json(raw)
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
            logger.warning("[%s] Groq rejected the JSON generation (attempt %d): %s", role, attempt, e)
    raise RuntimeError(f"[{role}] could not produce valid JSON: {last_error}")
