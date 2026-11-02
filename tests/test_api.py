from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import api
from api import ClarifyResponse, app
from auth import get_current_user

client = TestClient(app)


@pytest.fixture(autouse=True)
def logged_in():
    """Every test runs as user-1 unless it clears the override to test anonymous access."""
    app.dependency_overrides[get_current_user] = lambda: "user-1"
    yield
    app.dependency_overrides.clear()


class FakeSupabase:
    """Just enough of the supabase-py query builder: filters are matched against stored rows."""

    def __init__(self, tables=None):
        self.tables = tables or {}

    def table(self, name):
        rows = self.tables.setdefault(name, [])
        filters = []
        query = SimpleNamespace()
        query.select = lambda *a, **k: query
        query.order = lambda *a, **k: query
        query.eq = lambda col, val: (filters.append((col, val)), query)[1]
        query.insert = lambda new: (rows.extend(new if isinstance(new, list) else [new]), query)[1]
        changes = {}
        query.update = lambda values: (changes.update(values), query)[1]

        def execute():
            matched = [r for r in rows if all(r.get(c) == v for c, v in filters)]
            for r in matched:
                r.update(changes)
            return SimpleNamespace(data=matched)
        query.execute = execute
        return query


def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "Parakh API running", "docs": "/docs"}


@pytest.mark.parametrize("method, path, body", [
    ("post", "/simulate", {"idea": "An AI recipe app"}),
    ("post", "/clarify", {"idea": "An AI recipe app"}),
    ("post", "/simulate/abc/chat", {"messages": [{"role": "user", "content": "hi"}]}),
    ("get", "/simulate/abc", None),
    ("get", "/simulations/abc/chat", None),
    ("post", "/critique", {"text": "Burn 40k a month, runway 12 months, cash 2 lakh"}),
    ("get", "/critique/abc", None),
])
def test_endpoints_that_spend_quota_or_show_data_require_login(method, path, body):
    app.dependency_overrides.clear()
    r = getattr(client, method)(path, **({"json": body} if body else {}))
    assert r.status_code in (401, 403)


def test_clarify_uses_llm_json(monkeypatch):
    canned = ClarifyResponse(questions=[{"question": f"Q{i}?", "options": ["A", "B", "C"]} for i in range(10)])
    monkeypatch.setattr(api, "call_llm_json", lambda prompt, schema, role: canned)
    data = client.post("/clarify", json={"idea": "A CRM for pet sitters"}).json()
        # The fixed market/founder/funding/budget/AI questions come first, word for word, then 2 idea-specific ones.
    n = len(api.CLARIFY_FIXED)
    assert data["questions"][:n] == api.CLARIFY_FIXED
    assert [q["question"] for q in data["questions"][n:]] == ["Q0?", "Q1?"]


def test_clarify_falls_back_when_llm_fails(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("bharatcode down")
    monkeypatch.setattr(api, "call_llm_json", boom)
    data = client.post("/clarify", json={"idea": "A CRM for pet sitters"}).json()
    assert data["questions"][:len(api.CLARIFY_FIXED)] == api.CLARIFY_FIXED and len(data["questions"]) == len(api.CLARIFY_FIXED) + 1


def test_simulate_endpoint_queues_job_only_its_owner_can_see(monkeypatch):
    # TestClient runs background tasks inline; don't start a real simulation.
    monkeypatch.setattr(api, "run_simulation", lambda *a, **k: None)
    data = client.post("/simulate", json={"idea": "An AI recipe app", "constraints": "bootstrapped"}).json()
    assert data["status"] == "pending"
    assert client.get(f"/simulate/{data['job_id']}").json()["job_id"] == data["job_id"]

    app.dependency_overrides[get_current_user] = lambda: "user-2"
    assert client.get(f"/simulate/{data['job_id']}").status_code == 404


def test_chat_saves_history_and_sends_earlier_turns(monkeypatch):
    db = FakeSupabase({"simulations": [
        {"id": "sim-1", "job_id": "job-1", "user_id": "user-1", "final_report": "# Build Plan"}]})
    monkeypatch.setattr(api, "get_supabase", lambda: db)
    seen = {}
    monkeypatch.setattr(api, "call_llm", lambda prompt, role, system: seen.update(prompt=prompt, system=system) or "Answer")

    r = client.post("/simulate/job-1/chat", json={"messages": [
        {"role": "user", "content": "Why ₹299?"}, {"role": "assistant", "content": "Clinics pay that."},
        {"role": "user", "content": "And in month 2?"}]})

    assert r.status_code == 200 and r.json() == {"reply": "Answer"}
    assert "# Build Plan" in seen["system"]
    assert "Founder: Why ₹299?" in seen["prompt"] and seen["prompt"].endswith("Founder: And in month 2?")
    assert [(m["role"], m["content"]) for m in db.tables["chat_messages"]] == [("user", "And in month 2?"), ("assistant", "Answer")]
    history = client.get("/simulations/sim-1/chat").json()
    assert [m["content"] for m in history] == ["And in month 2?", "Answer"]


def test_chat_on_someone_elses_simulation_is_not_found(monkeypatch):
    db = FakeSupabase({"simulations": [
        {"id": "sim-1", "job_id": "job-1", "user_id": "user-2", "final_report": "# Their plan"}]})
    monkeypatch.setattr(api, "get_supabase", lambda: db)
    monkeypatch.setattr(api, "call_llm", lambda *a, **k: pytest.fail("must not call the LLM"))
    r = client.post("/simulate/job-1/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 404
    assert client.get("/simulations/sim-1/chat").json() == []


def test_chat_falls_back_to_the_owners_finished_job_when_the_save_failed(monkeypatch):
    monkeypatch.setattr(api, "get_supabase", lambda: FakeSupabase())
    monkeypatch.setattr(api, "call_llm", lambda prompt, role, system: "Answer")
    job_id = api.create_job("user-1")
    api.update_job(job_id, status=api.JobStatus.DONE, result={"final_report": "# Build Plan"})
    r = client.post(f"/simulate/{job_id}/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert r.status_code == 200


def test_visitor_bharatcode_key_reaches_every_agent_of_a_background_simulation(slices, monkeypatch):
    import graph_orchestrator as go
    from agents import llm_router
    from models import BuildSlice, CriticResult, EconomicsSlice, GrowthSlice, StrategySlice

    seen = []
    for owner, model in (("strategist", StrategySlice), ("builder", BuildSlice),
                         ("economics", EconomicsSlice), ("growth", GrowthSlice)):
        def runner(state, o=owner, m=model):
            seen.append(llm_router._own_key())
            return m.model_validate(slices[o])
        monkeypatch.setitem(go.RUNNERS, owner, runner)
    monkeypatch.setattr(go.critic, "run", lambda state, math: (seen.append(llm_router._own_key()), CriticResult(
        issues=[], biggest_risk="Clinics ignore SMS from unknown numbers.", verdict="Viable with 4 clinics.",
        adherence_score=0.9))[1])
    monkeypatch.setattr(go, "save_state", lambda *a, **k: None)
    monkeypatch.setattr(go, "get_lessons_from_db", lambda profile: [])
    monkeypatch.setattr("time.sleep", lambda s: None)  # run_simulation pauses 1s for SSE to flush

    r = client.post("/simulate", json={"idea": "SMS reminders for dental clinics", "constraints": "bootstrapped"},
                    headers={"X-BharatCode-Key": " bc_visitor "})
    assert api.get_job(r.json()["job_id"])["status"] == "done"
    assert seen == ["bc_visitor"] * 5
    assert llm_router._own_key() is None  # nothing leaks past the request


def test_clarify_without_key_uses_the_server_key(monkeypatch):
    from agents import llm_router
    seen = []
    canned = ClarifyResponse(questions=[{"question": f"Q{i}?", "options": ["A", "B", "C"]} for i in range(3)])
    monkeypatch.setattr(api, "call_llm_json", lambda *a, **k: seen.append(llm_router._own_key()) or canned)
    client.post("/clarify", json={"idea": "A CRM for pet sitters"})
    assert seen == [None]


@pytest.mark.parametrize("language,expect_hinglish", [("hinglish", True), ("en", False)])
def test_chat_can_answer_in_hinglish(monkeypatch, language, expect_hinglish):
    monkeypatch.setattr(api, "get_supabase", lambda: FakeSupabase({"simulations": [
        {"id": "sim-1", "job_id": "job-1", "user_id": "user-1", "final_report": "# Build Plan"}]}))
    seen = {}
    monkeypatch.setattr(api, "call_llm", lambda prompt, role, system: seen.update(system=system) or "Haan, chalega.")
    r = client.post("/simulate/job-1/chat", json={"language": language, "messages": [{"role": "user", "content": "Price theek hai?"}]})
    assert r.status_code == 200
    assert ("Reply in Hinglish" in seen["system"]) is expect_hinglish
    assert ("Reply in plain English only" in seen["system"]) is not expect_hinglish


PNG = "data:image/png;base64," + "A" * 40


@pytest.mark.parametrize("body, status", [
    ({}, 400),                                                         # nothing to read
    ({"text": "too short"}, 400),
    ({"images": ["data:application/pdf;base64,AAAA"]}, 400),           # not an image
    ({"images": ["data:image/png;base64," + "A" * 7_000_000]}, 413),   # over 5 MB
    ({"images": [PNG] * 4}, 422),                                      # more than 3 slides
])
def test_critique_rejects_bad_input(body, status):
    assert client.post("/critique", json=body).status_code == status


def test_critique_runs_in_the_background_for_its_owner_only(monkeypatch):
    import agents.deck_reader as deck
    seen = {}
    monkeypatch.setattr(deck, "critique", lambda images, text, idea: seen.update(images=images, text=text, idea=idea) or {"findings": []})
    r = client.post("/critique", json={"images": [PNG], "text": "  Burn 40k, runway 12 months  ", "idea": "Notes app"})
    job_id = r.json()["job_id"]
    assert seen == {"images": [PNG], "text": "Burn 40k, runway 12 months", "idea": "Notes app"}
    assert client.get(f"/critique/{job_id}").json() == {"job_id": job_id, "status": "done", "result": {"findings": []}}
    app.dependency_overrides[get_current_user] = lambda: "user-2"
    assert client.get(f"/critique/{job_id}").status_code == 404


def test_critique_failure_message_is_safe_for_users(monkeypatch):
    import agents.deck_reader as deck

    def boom(*a):
        raise RuntimeError("internal stack detail")
    monkeypatch.setattr(deck, "critique", boom)
    job_id = client.post("/critique", json={"text": "Burn 40k a month, runway 12 months"}).json()["job_id"]
    assert client.get(f"/critique/{job_id}").json()["error"] == "The critique failed. Try again in a minute."


def test_a_plan_is_private_until_its_owner_shares_it(monkeypatch):
    db = FakeSupabase({"simulations": [{"id": "sim-1", "user_id": "user-1", "idea": "Notes app", "is_public": False,
                                        "business_plan": {"mission": "m"}, "final_report": "# Plan", "constraints": "my answers"}]})
    monkeypatch.setattr(api, "get_supabase", lambda: db)
    app.dependency_overrides.clear()  # the public page is anonymous
    assert client.get("/shared/sim-1").status_code == 404

    app.dependency_overrides[get_current_user] = lambda: "user-2"
    assert client.patch("/simulations/sim-1/share", json={"public": True}).status_code == 404  # not their plan
    app.dependency_overrides[get_current_user] = lambda: "user-1"
    assert client.patch("/simulations/sim-1/share", json={"public": True}).json() == {"id": "sim-1", "is_public": True}

    app.dependency_overrides.clear()
    shared = client.get("/shared/sim-1")
    assert shared.status_code == 200
    # The fake returns whole rows; the real query only selects SHARED_FIELDS, which must leave these out.
    assert "user_id" not in api.SHARED_FIELDS and "constraints" not in api.SHARED_FIELDS


def test_clarify_stops_early_when_the_key_cannot_use_the_model(monkeypatch):
    from agents.llm_router import BharatCodeAccessError
    def no_access(*a, **k):
        raise BharatCodeAccessError("The server's BharatCode key can't use qwen-3.8-27b yet. ... https://bharatcode.ai/account")
    monkeypatch.setattr(api, "call_llm_json", no_access)
    r = client.post("/clarify", json={"idea": "A CRM for pet sitters"})
    assert r.status_code == 402 and "bharatcode.ai/account" in r.json()["detail"]


def test_a_verified_token_is_not_checked_again_on_every_request(monkeypatch):
    import base64
    import json
    import time
    import auth
    calls = []
    fake = SimpleNamespace(auth=SimpleNamespace(get_user=lambda t: calls.append(t) or SimpleNamespace(user=SimpleNamespace(id="user-9"))))
    monkeypatch.setattr(auth, "get_supabase", lambda: fake)
    monkeypatch.setattr(auth, "_verified", {})
    payload = base64.urlsafe_b64encode(json.dumps({"exp": time.time() + 3600}).encode()).decode().rstrip("=")
    token = f"h.{payload}.s"
    creds = SimpleNamespace(credentials=token)
    assert auth.get_current_user(creds) == "user-9"
    assert auth.get_current_user(creds) == "user-9"
    assert calls == [token]


def test_an_expired_token_is_checked_again(monkeypatch):
    import base64
    import json
    import time
    import auth
    calls = []
    fake = SimpleNamespace(auth=SimpleNamespace(get_user=lambda t: calls.append(t) or SimpleNamespace(user=SimpleNamespace(id="user-9"))))
    monkeypatch.setattr(auth, "get_supabase", lambda: fake)
    monkeypatch.setattr(auth, "_verified", {})
    payload = base64.urlsafe_b64encode(json.dumps({"exp": time.time() - 5}).encode()).decode().rstrip("=")
    creds = SimpleNamespace(credentials=f"h.{payload}.s")
    auth.get_current_user(creds)
    auth.get_current_user(creds)
    assert len(calls) == 2
