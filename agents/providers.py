"""
The model providers a Parakh user can run plans on, BharatCode first.

BharatCode is the default and runs on the server's key (or the visitor's own BharatCode key).
Every other provider needs the visitor's own key, which arrives per request in a header, is used
for that request only, and is never stored or logged.

Facts per provider were read from their docs on 2026-11-02:
- Gemini: OpenAI-compatible endpoint https://generativelanguage.googleapis.com/v1beta/openai/
- OpenRouter: OpenAI-compatible endpoint https://openrouter.ai/api/v1, optional X-OpenRouter-Title header
- Claude: native Anthropic SDK, so the shared start of each prompt can be marked for caching
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Provider:
    id: str
    label: str
    kind: str                       # "openai" (OpenAI-compatible API) or "anthropic"
    default_model: str
    base_url: str | None = None
    server_key_env: str | None = None   # only BharatCode may fall back to a key on the server
    no_think: bool = False          # send Qwen's "thinking off" switch
    sampling: bool = True           # send temperature/top_p (newer OpenAI and Claude models reject them)
    token_param: str = "max_tokens"  # OpenAI's newer models want max_completion_tokens
    headers: dict = field(default_factory=dict)


PROVIDERS: dict[str, Provider] = {
    "bharatcode": Provider("bharatcode", "BharatCode", "openai", default_model="qwen-3.8-27b",
                           server_key_env="BHARATCODE_API_KEY", no_think=True),
    "openai": Provider("openai", "OpenAI", "openai", default_model="gpt-6-luna",
                       base_url="https://api.openai.com/v1", sampling=False, token_param="max_completion_tokens"),
    "anthropic": Provider("anthropic", "Claude", "anthropic", default_model="claude-sonnet-5-5", sampling=False),
    "gemini": Provider("gemini", "Gemini", "openai", default_model="gemini-2.5-flash",
                       base_url="https://generativelanguage.googleapis.com/v1beta/openai/"),
    "openrouter": Provider("openrouter", "OpenRouter", "openai", default_model="",
                           base_url="https://openrouter.ai/api/v1", headers={"X-OpenRouter-Title": "Parakh"}),
}

DEFAULT_PROVIDER = "bharatcode"


# USD per million tokens, read from each provider's pricing page on 2026-11-02. "cached" is the price
# of a prompt token served from the provider's cache; None where the page didn't give it (those
# tokens are then counted at the full input price, so the estimate errs high).
PRICES_CHECKED_ON = "2026-11-02"
MODEL_PRICES: dict[tuple[str, str], dict] = {
    ("anthropic", "claude-opus-5-5"): {"in": 4.0, "out": 20.0, "cached": 0.20},
    ("anthropic", "claude-sonnet-5-5"): {"in": 2.0, "out": 10.0, "cached": 0.10},
    ("anthropic", "claude-haiku-5-5"): {"in": 0.10, "out": 0.50, "cached": None},
    ("openai", "gpt-6-luna"): {"in": 0.10, "out": 0.50, "cached": None},
    ("gemini", "gemini-2.5-flash"): {"in": 0.30, "out": 2.50, "cached": None},
    ("gemini", "gemini-2.5-flash-lite"): {"in": 0.10, "out": 0.40, "cached": None},
    ("gemini", "gemini-3.8-flash"): {"in": 0.75, "out": 3.75, "cached": None},  # price doubles on 1 Jan 2027
}
PRICE_SOURCES = {
    "anthropic": "https://platform.claude.com/docs/en/about-claude/pricing",
    "openai": "https://developers.openai.com/api/docs/pricing",
    "gemini": "https://ai.google.dev/gemini-api/docs/pricing",
}


def estimate_cost_usd(calls: list[dict]) -> float | None:
    """Rough cost of a run's calls in USD, or None if any call used a model without a known price.
    BharatCode is flat-rate (free student quota or a monthly plan), so its calls add 0."""
    total = 0.0
    for c in calls:
        if c.get("provider", "bharatcode") == "bharatcode":
            continue
        price = MODEL_PRICES.get((c["provider"], c["model"]))
        if not price:
            return None
        cached = c.get("cached", 0) if price["cached"] is not None else 0
        total += ((c["in"] - cached) * price["in"] + cached * (price["cached"] or 0) + c["out"] * price["out"]) / 1_000_000
    return round(total, 4)
