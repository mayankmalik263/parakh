import pytest

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


@pytest.mark.parametrize("idea", ["Notes sharing app for my college", "An app where hostel students tell us what to cook"])
def test_blank_market_defaults_to_an_indian_student_founder(idea):
    p = build_profile(_state(startup_idea=idea, market="", constraints=""))
    assert (p["market"], p["currency"], p["funding"], p["student"]) == ("India", "INR", "bootstrapped", True)
    assert (p["mvp_cap"], p["burn_cap"]) == (15_000, 10_000)


def test_a_named_foreign_market_is_not_assumed_india():
    p = build_profile(_state(startup_idea="Scheduling tool for dentists in the USA", market="not specified"))
    assert (p["currency"], p["funding"], p["student"]) == ("USD", "unspecified", False)


def test_clarify_markers_beat_the_question_wording():
    # The free-text context carries the question text, which mentions both funding modes.
    constraints = "Funding: Venture. Founder: Full-time. Context: How will you fund the start? Bootstrapped or venture?"
    p = build_profile(_state(market="India", constraints=constraints))
    assert (p["funding"], p["student"], p["burn_cap"]) == ("venture", False, None)


def test_working_founder_in_india_gets_the_wider_bootstrapped_caps():
    p = build_profile(_state(market="India", constraints="Funding: Bootstrapped. Founder: Professional."))
    assert (p["student"], p["mvp_cap"], p["burn_cap"]) == (False, 40_000, 30_000)


def test_student_context_block_is_campus_first():
    block = build_context_block(_state(market="India"))
    assert "nights and weekends" in block and "WhatsApp groups" in block
    assert "MVP build cost under ₹15,000" in block and "Monthly burn under ₹10,000" in block


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


def _status_error(cls_name: str, status: int, headers: dict | None = None):
    """An openai SDK error carrying a fake HTTP response, as BharatCode would trigger it."""
    import httpx2
    import openai
    resp = httpx2.Response(status, headers=headers or {}, request=httpx2.Request("POST", "https://bharatcode.test"))
    return getattr(openai, cls_name)(f"HTTP {status}", response=resp, body=None)


def _fake_client(script: list, calls: list):
    """A client whose create() raises or returns the next item of `script` on each call."""
    from types import SimpleNamespace

    def create(**kwargs):
        calls.append(kwargs)
        step = script.pop(0) if len(script) > 1 else script[0]
        if isinstance(step, Exception):
            raise step
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=step))], usage=None)

    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))


def test_only_standard_openai_params_are_sent(monkeypatch):
    from agents import llm_router as r
    calls = []
    monkeypatch.setattr(r, "_get_client", lambda: _fake_client(["ok"], calls))
    r.call_llm("hi", role="strategist")
    sent = calls[0]
    assert sent["model"] == r.MODEL
    assert not any(k.startswith("reasoning") for k in sent), "Groq-only params make BharatCode return 400"


def test_busy_server_is_retried_then_succeeds(monkeypatch):
    from agents import llm_router as r
    calls, waits = [], []
    busy = _status_error("InternalServerError", 503)
    monkeypatch.setattr(r, "_get_client", lambda: _fake_client([busy, busy, "ok"], calls))
    monkeypatch.setattr(r.time, "sleep", waits.append)
    assert r.call_llm("hi", role="builder") == "ok"
    assert len(calls) == 3 and len(waits) == 2
    assert waits[1] > waits[0]  # backoff grows


def test_server_still_busy_gives_a_readable_error(monkeypatch):
    import pytest
    from agents import llm_router as r
    monkeypatch.setattr(r, "_get_client", lambda: _fake_client([_status_error("InternalServerError", 503)], []))
    monkeypatch.setattr(r.time, "sleep", lambda s: None)
    with pytest.raises(RuntimeError, match="BharatCode is busy"):
        r.call_llm("hi", role="growth")


def test_daily_quota_is_not_waited_out(monkeypatch):
    import pytest
    from agents import llm_router as r
    quota = _status_error("RateLimitError", 429, {"retry-after": "3600"})
    monkeypatch.setattr(r, "_get_client", lambda: _fake_client([quota], []))
    monkeypatch.setattr(r.time, "sleep", lambda s: (_ for _ in ()).throw(AssertionError("must not wait out a daily quota")))
    with pytest.raises(RuntimeError, match="AI quota is used up"):
        r.call_llm("hi", role="critic")


def test_separate_critic_model_falls_back_to_main_model(monkeypatch):
    from agents import llm_router as r
    calls = []
    monkeypatch.setitem(r.ROLE_MODELS, "critic", "pro-model")
    monkeypatch.setattr(r, "FALLBACK", {"pro-model": [r.MODEL]})
    client = _fake_client([_status_error("NotFoundError", 404), "ok"], calls)  # one client: the script must not restart
    monkeypatch.setattr(r, "_get_client", lambda: client)
    assert r.call_llm("hi", role="critic") == "ok"
    assert [c["model"] for c in calls] == ["pro-model", r.MODEL]


def test_json_reply_with_thinking_and_fences_is_parsed(monkeypatch):
    from agents import llm_router as r
    from models import Objection
    reply = '<think>They want JSON.</think>\nSure:\n```json\n{"objection": "Too pricey", "response": "It pays for itself."}\n```'
    monkeypatch.setattr(r, "_get_client", lambda: _fake_client([reply], []))
    assert r.call_llm_json("hi", Objection, role="growth").objection == "Too pricey"


def test_rejected_visitor_key_gives_a_readable_error(monkeypatch):
    import pytest
    from agents import llm_router as r
    monkeypatch.setattr(r, "OpenAI", lambda **kw: _fake_client([_status_error("AuthenticationError", 401)], []))
    with r.use_bharatcode_key("bc_wrong"), pytest.raises(RuntimeError, match="Your BharatCode API key was rejected"):
        r.call_llm("hi", role="strategist")


def test_unverified_student_key_says_how_to_unlock_the_model(monkeypatch):
    # BharatCode answers 402 when a key isn't allowed the model yet (e.g. student email not verified).
    import pytest
    from agents import llm_router as r
    monkeypatch.setattr(r, "_get_client", lambda: _fake_client([_status_error("APIStatusError", 402)], []))
    with pytest.raises(r.BharatCodeAccessError, match="bharatcode.ai/account"):
        r.call_llm("hi", role="strategist")


def test_thinking_is_switched_off_by_default(monkeypatch):
    from agents import llm_router as r
    calls = []
    monkeypatch.setattr(r, "_send_no_think", True)
    monkeypatch.setattr(r, "_get_client", lambda: _fake_client(["ok"], calls))
    r.call_llm("hi", role="strategist")
    assert calls[0]["extra_body"] == {"chat_template_kwargs": {"enable_thinking": False}}


def test_rejected_thinking_switch_is_dropped_and_the_call_still_works(monkeypatch):
    from agents import llm_router as r
    calls = []
    monkeypatch.setattr(r, "_send_no_think", True)
    monkeypatch.setattr(r, "_get_client", lambda: _fake_client([_status_error("BadRequestError", 400), "ok"], calls))
    assert r.call_llm("hi", role="strategist") == "ok"
    assert "extra_body" in calls[0] and "extra_body" not in calls[1]
    assert r._send_no_think is False


def test_empty_reply_is_retried_once_with_more_room(monkeypatch):
    # A reply that is only an unfinished <think> block: the model ran out of tokens mid-thought.
    from agents import llm_router as r
    calls = []
    monkeypatch.setattr(r, "_get_client", lambda: _fake_client(["<think>Let me weigh the price", "the answer"], calls))
    assert r.call_llm("hi", role="economics", max_tokens=3000) == "the answer"
    assert calls[1]["max_tokens"] == 6000 and calls[1]["messages"][-1]["content"].endswith("/no_think")


def test_empty_reply_twice_gives_a_readable_error(monkeypatch):
    import pytest
    from agents import llm_router as r
    monkeypatch.setattr(r, "_get_client", lambda: _fake_client([""], []))
    with pytest.raises(r.EmptyReplyError, match="The growth agent got no answer"):
        r.call_llm("hi", role="growth")


def test_stray_text_after_the_json_is_cut_instead_of_retried(monkeypatch):
    # BharatCode's Qwen sometimes ends a valid reply with "parameter" after the closing brace.
    from agents import llm_router as r
    from models import Objection
    calls = []
    monkeypatch.setattr(r, "_get_client", lambda: _fake_client(['{"objection": "Too pricey", "response": "It pays for itself."}parameter'], calls))
    assert r.call_llm_json("hi", Objection, role="growth").response == "It pays for itself."
    assert len(calls) == 1


def test_capitalised_json_keys_are_accepted_without_a_retry(monkeypatch):
    from pydantic import BaseModel
    from agents import llm_router

    class Channel(BaseModel):
        name: str
        tactic: str

    class Plan(BaseModel):
        channels: list[Channel]

    sent = []
    def reply(role, messages, json_mode, max_tokens):
        sent.append(messages)
        return '{"Channels": [{"Name": "WhatsApp groups", "Tactic": "Post the free sample PDF"}]}'
    monkeypatch.setattr(llm_router, "_complete_with_fallback", reply)
    plan = llm_router.call_llm_json("plan", Plan, role="growth")
    assert plan.channels[0].tactic == "Post the free sample PDF"
    assert len(sent) == 1


def test_broken_json_still_gets_one_retry(monkeypatch):
    from pydantic import BaseModel
    from agents import llm_router

    class Small(BaseModel):
        name: str

    replies = iter(['{"name": ', '{"name": "ok"}'])
    monkeypatch.setattr(llm_router, "_complete_with_fallback", lambda *a, **k: next(replies))
    assert llm_router.call_llm_json("x", Small).name == "ok"
