from agents.context_block import build_context_block, build_profile


def _state(**kw):
    return {"startup_idea": "A CRM for pet sitters", "lessons": [], **kw}


def test_profile_bootstrapped_us():
    p = build_profile(_state(market="US", constraints="bootstrapped"))
    assert (p["currency"], p["funding"], p["burn_cap"]) == ("USD", "bootstrapped", 500)


def test_profile_india_venture():
    p = build_profile(_state(startup_idea="Grocery delivery in Delhi", market="India", constraints="Venture backed"))
    assert (p["currency"], p["symbol"], p["funding"], p["burn_cap"]) == ("INR", "₹", "venture", None)


def test_profile_no_substring_false_positives():
    # "services" contains "vc"; "business" contains "us". Neither may flip the profile.
    p = build_profile(_state(market="Global", constraints="Selling services to business owners"))
    assert (p["funding"], p["currency"]) == ("unspecified", "USD")


def test_context_block_bootstrapped_rules():
    state = _state(market="US", constraints="bootstrapped")
    block = build_context_block(state)
    assert "Bootstrapped: no VC" in block
    assert "Monthly burn under $500" in block
    assert "PAST OBSERVATIONS" not in block


def test_context_block_lessons_are_advisory():
    block = build_context_block(_state(market="US", lessons=["Price above $20 for clinics."]))
    assert "PAST OBSERVATIONS (advisory" in block
    assert "MUST follow" not in block


def _fake_groq(exhausted: set, calls: list):
    """A Groq client whose models in `exhausted` answer with a daily-quota 429."""
    from types import SimpleNamespace

    import httpx
    from groq import RateLimitError

    def create(model, **kwargs):
        calls.append(model)
        if model in exhausted:
            resp = httpx.Response(429, headers={"retry-after": "352"}, request=httpx.Request("POST", "https://x"))
            raise RateLimitError("Rate limit reached on tokens per day (TPD)", response=resp, body=None)
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="ok"))], usage=None)

    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))


def test_daily_quota_falls_back_to_next_model(monkeypatch):
    from agents import llm_router as r
    calls = []
    monkeypatch.setattr(r, "_get_client", lambda: _fake_groq({r.OSS_120B}, calls))
    monkeypatch.setattr(r.time, "sleep", lambda s: (_ for _ in ()).throw(AssertionError("must not wait out a daily quota")))
    assert r.call_llm("hi", role="strategist") == "ok"
    assert calls == [r.OSS_120B, r.OSS_20B]


def test_all_models_exhausted_gives_a_readable_error(monkeypatch):
    import pytest
    from agents import llm_router as r
    monkeypatch.setattr(r, "_get_client", lambda: _fake_groq({r.QWEN, r.OSS_120B, r.OSS_20B}, []))
    with pytest.raises(RuntimeError, match="free AI quota is used up. Try again in about 6 minute"):
        r.call_llm("hi", role="critic")


def test_rejected_visitor_key_gives_a_readable_error(monkeypatch):
    from types import SimpleNamespace

    import httpx
    import pytest
    from groq import AuthenticationError

    from agents import llm_router as r

    def create(model, **kwargs):
        resp = httpx.Response(401, request=httpx.Request("POST", "https://x"))
        raise AuthenticationError("Invalid API Key", response=resp, body=None)

    monkeypatch.setattr(r, "Groq", lambda api_key, max_retries: SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=create))))
    with r.use_groq_key("gsk_wrong"), pytest.raises(RuntimeError, match="Your Groq API key was rejected"):
        r.call_llm("hi", role="strategist")
