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
        query.execute = lambda: SimpleNamespace(data=[r for r in rows if all(r.get(c) == v for c, v in filters)])
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
])
def test_endpoints_that_spend_quota_or_show_data_require_login(method, path, body):
    app.dependency_overrides.clear()
    r = getattr(client, method)(path, **({"json": body} if body else {}))
    assert r.status_code in (401, 403)


def test_clarify_uses_llm_json(monkeypatch):
    canned = ClarifyResponse(questions=[{"question": f"Q{i}?", "options": ["A", "B", "C"]} for i in range(10)])
    monkeypatch.setattr(api, "call_llm_json", lambda prompt, schema, role: canned)
    data = client.post("/clarify", json={"idea": "A CRM for pet sitters"}).json()
    # The fixed market/founder/funding questions come first, word for word, then 3 idea-specific ones.
    assert data["questions"][:3] == api.CLARIFY_FIXED
    assert [q["question"] for q in data["questions"][3:]] == ["Q0?", "Q1?", "Q2?"]


def test_clarify_falls_back_when_llm_fails(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("bharatcode down")
    monkeypatch.setattr(api, "call_llm_json", boom)
    data = client.post("/clarify", json={"idea": "A CRM for pet sitters"}).json()
    assert data["questions"][:3] == api.CLARIFY_FIXED and len(data["questions"]) == 4


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
            seen.append(llm_router._user_key.get())
            return m.model_validate(slices[o])
        monkeypatch.setitem(go.RUNNERS, owner, runner)
    monkeypatch.setattr(go.critic, "run", lambda state, math: (seen.append(llm_router._user_key.get()), CriticResult(
        issues=[], biggest_risk="Clinics ignore SMS from unknown numbers.", verdict="Viable with 4 clinics.",
        adherence_score=0.9))[1])
    monkeypatch.setattr(go, "save_state", lambda *a, **k: None)
    monkeypatch.setattr(go, "get_lessons_from_db", lambda profile: [])
    monkeypatch.setattr("time.sleep", lambda s: None)  # run_simulation pauses 1s for SSE to flush

    r = client.post("/simulate", json={"idea": "SMS reminders for dental clinics", "constraints": "bootstrapped"},
                    headers={"X-BharatCode-Key": " bc_visitor "})
    assert api.get_job(r.json()["job_id"])["status"] == "done"
    assert seen == ["bc_visitor"] * 5
    assert llm_router._user_key.get() is None  # nothing leaks past the request


def test_clarify_without_key_uses_the_server_key(monkeypatch):
    from agents import llm_router
    seen = []
    canned = ClarifyResponse(questions=[{"question": f"Q{i}?", "options": ["A", "B", "C"]} for i in range(3)])
    monkeypatch.setattr(api, "call_llm_json", lambda *a, **k: seen.append(llm_router._user_key.get()) or canned)
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
    assert ("Hinglish" in seen["system"]) is expect_hinglish
