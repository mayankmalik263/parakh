"""Bring-your-own-key providers: what each one is sent, how errors read, and what a plan costs."""
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import api
from agents import llm_router
from agents.providers import MODEL_PRICES, estimate_cost_usd
from api import ClarifyResponse, app
from auth import get_current_user

client = TestClient(app)


@pytest.fixture(autouse=True)
def fresh_router(monkeypatch):
    monkeypatch.setattr(llm_router, "_refused", {})
    app.dependency_overrides[get_current_user] = lambda: "user-1"
    yield
    app.dependency_overrides.clear()


def _openai_reply(text='{"ok": true}', prompt=100, completion=20, cached=0):
    usage = SimpleNamespace(prompt_tokens=prompt, completion_tokens=completion, completion_tokens_details=None,
                            prompt_tokens_details=SimpleNamespace(cached_tokens=cached))
    msg = SimpleNamespace(content=text)
    return SimpleNamespace(choices=[SimpleNamespace(message=msg, finish_reason="stop")], usage=usage)


class FakeOpenAI:
    """Records every chat.completions.create call; answers from a queue of replies or exceptions."""

    def __init__(self, replies):
        self.sent, self.replies = [], list(replies)
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.sent.append(kwargs)
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply


def _status_error(status, message):
    import httpx
    from openai import APIStatusError
    req = httpx.Request("POST", "https://example.test/v1/chat/completions")
    return APIStatusError(message, response=httpx.Response(status, request=req), body=None)


# ── headers pick the provider ──

def test_provider_headers_reach_every_llm_call(monkeypatch):
    seen = []
    canned = ClarifyResponse(questions=[{"question": f"Q{i}?", "options": ["A", "B", "C"]} for i in range(3)])

    def fake(*a, **k):
        seen.append((llm_router.current_provider().id, llm_router._own_key(), llm_router.model_for("strategist")))
        return canned
    monkeypatch.setattr(api, "call_llm_json", fake)
    client.post("/clarify", json={"idea": "A CRM for pet sitters"},
                headers={"X-Parakh-Provider": "Gemini", "X-Parakh-Key": "g-key", "X-Parakh-Model": "gemini-2.5-flash-lite"})
    assert seen == [("gemini", "g-key", "gemini-2.5-flash-lite")]
    assert llm_router.current_provider().id == "bharatcode"  # nothing leaks past the request


def test_unknown_provider_is_refused():
    r = client.post("/clarify", json={"idea": "A CRM for pet sitters"}, headers={"X-Parakh-Provider": "skynet"})
    assert r.status_code == 400
    assert "skynet" in r.json()["detail"]


def test_default_model_per_provider_and_openrouter_needs_one():
    with llm_router.use_provider("anthropic", "k"):
        assert llm_router.model_for("critic") == "claude-sonnet-5-5"
    with llm_router.use_provider("openrouter", "k"):
        with pytest.raises(RuntimeError):
            llm_router.model_for("critic")
    with llm_router.use_provider("bharatcode"):
        assert llm_router.model_for("critic") == llm_router.ROLE_MODELS["critic"]


def test_other_providers_never_use_the_server_key(monkeypatch):
    monkeypatch.setenv("BHARATCODE_API_KEY", "server-key")
    with llm_router.use_provider("openai"):
        with pytest.raises(RuntimeError, match="Paste your OpenAI API key"):
            llm_router._get_client()


# ── what each provider is sent ──

def test_openai_gets_max_completion_tokens_and_no_sampling(monkeypatch):
    fake = FakeOpenAI([_openai_reply("hello")])
    monkeypatch.setattr(llm_router, "_get_client", lambda: fake)
    with llm_router.use_provider("openai", "sk-test"):
        llm_router.call_llm("Say hi", role="strategist", shared="CONTEXT")
    sent = fake.sent[0]
    assert sent["model"] == "gpt-6-luna"
    assert "max_completion_tokens" in sent and "max_tokens" not in sent
    assert "temperature" not in sent and "top_p" not in sent and "extra_body" not in sent
    # Shared context and the prompt arrive as one plain string, with no cache markers.
    user = sent["messages"][-1]["content"]
    assert isinstance(user, str) and user.startswith("CONTEXT") and user.endswith("Say hi")


def test_json_mode_dropped_once_a_provider_rejects_it(monkeypatch):
    fake = FakeOpenAI([_status_error(400, "response_format json_object is not supported"), _openai_reply(), _openai_reply()])
    monkeypatch.setattr(llm_router, "_get_client", lambda: fake)
    with llm_router.use_provider("openrouter", "or-key", "some/model"):
        for _ in range(2):
            llm_router._complete_with_fallback("strategist", [{"role": "user", "content": "Give JSON"}], json_mode=True, max_tokens=500)
    assert "response_format" in fake.sent[0]
    assert "response_format" not in fake.sent[1] and "response_format" not in fake.sent[2]


def test_claude_marks_system_and_shared_blocks_for_caching(monkeypatch):
    sent = []

    def create(**kwargs):
        sent.append(kwargs)
        usage = SimpleNamespace(input_tokens=50, output_tokens=10, cache_read_input_tokens=900, cache_creation_input_tokens=0)
        return SimpleNamespace(content=[SimpleNamespace(type="text", text="done")], usage=usage, stop_reason="end_turn")
    monkeypatch.setattr(llm_router, "_get_anthropic", lambda: SimpleNamespace(messages=SimpleNamespace(create=create)))
    with llm_router.token_meter() as calls, llm_router.use_provider("anthropic", "sk-ant"):
        llm_router.call_llm("Rewrite the plan", role="builder", system="You are the BUILDER.", shared="CONTEXT + PLAN SO FAR")
    kw = sent[0]
    assert "temperature" not in kw
    assert kw["system"][0]["cache_control"] == {"type": "ephemeral"}
    blocks = kw["messages"][-1]["content"]
    assert blocks[0]["text"] == "CONTEXT + PLAN SO FAR" and blocks[0]["cache_control"] == {"type": "ephemeral"}
    assert blocks[-1]["text"] == "Rewrite the plan" and "cache_control" not in blocks[-1]
    assert calls[0]["in"] == 950 and calls[0]["cached"] == 900 and calls[0]["provider"] == "anthropic"


@pytest.mark.parametrize("status,words", [(401, "rejected"), (404, "doesn't know the model"), (429, "rate limit")])
def test_own_key_errors_read_plainly(monkeypatch, status, words):
    fake = FakeOpenAI([_status_error(status, "nope") for _ in range(llm_router.MAX_ATTEMPTS)])  # 429 is retried
    monkeypatch.setattr(llm_router, "_get_client", lambda: fake)
    monkeypatch.setattr(llm_router.time, "sleep", lambda s: None)
    monkeypatch.setattr(llm_router, "_wait_seconds", lambda e, attempt: 0)
    with llm_router.use_provider("gemini", "g-key"):
        with pytest.raises(RuntimeError, match=words):
            llm_router.call_llm("hi", role="strategist")
    # Retries stay on the visitor's model: no fallback to another model on someone else's key.
    assert {c["model"] for c in fake.sent} == {"gemini-2.5-flash"}


# ── cost line ──

def test_cost_estimate_counts_cached_tokens_at_the_cache_price():
    calls = [{"provider": "anthropic", "model": "claude-sonnet-5-5", "in": 10_000, "out": 2_000, "cached": 8_000}]
    p = MODEL_PRICES[("anthropic", "claude-sonnet-5-5")]
    expected = (2_000 * p["in"] + 8_000 * p["cached"] + 2_000 * p["out"]) / 1_000_000
    assert estimate_cost_usd(calls) == round(expected, 4)


def test_cost_estimate_unknown_model_and_flat_rate():
    assert estimate_cost_usd([{"provider": "openrouter", "model": "x/y", "in": 1, "out": 1}]) is None
    assert estimate_cost_usd([{"provider": "bharatcode", "model": "qwen-3.8-27b", "in": 9_999, "out": 999}]) == 0


def test_run_stats_sums_the_meter():
    calls = [{"provider": "gemini", "model": "gemini-2.5-flash", "in": 1_000, "out": 200, "cached": 0},
             {"provider": "gemini", "model": "gemini-2.5-flash", "in": 3_000, "out": 400, "cached": 0}]
    with llm_router.use_provider("gemini", "g-key"):
        stats = llm_router.run_stats(calls, 61.4)
    assert stats["provider_label"] == "Gemini" and stats["calls"] == 2 and stats["own_key"] is True
    assert (stats["tokens_in"], stats["tokens_out"], stats["seconds"]) == (4_000, 600, 61)
    assert stats["cost_usd"] == round((4_000 * 0.30 + 600 * 2.50) / 1_000_000, 4)
