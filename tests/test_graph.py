import copy

import pytest

import graph_orchestrator as go
from evaluation_engine import EvaluationEngine, autofix_math, check_plan
from models import BuildSlice, CriticResult, EconomicsSlice, GrowthSlice, StrategySlice
from report_generator import build_display_plan, render_report


def test_consistent_plan_passes_math(slices, profile):
    assert check_plan(slices, profile) == []


@pytest.mark.parametrize("mutate, owner, needle", [
    (lambda s: s["economics"].update(monthly_burn=999), "economics", "sum of burn line items"),
    (lambda s: s["economics"].update(runway_months=30), "economics", "Runway"),
    (lambda s: s["economics"].update(break_even_customers=1), "economics", "break_even_customers"),
    (lambda s: s["economics"]["revenue_targets"][2].update(mrr=5000), "economics", "Day 90 MRR"),
    (lambda s: s["economics"].update(external_funding=50000), "economics", "bootstrapped"),
    (lambda s: s["growth"]["channels"][0].update(monthly_spend=900, cac=225), "growth", "marketing budget"),
    (lambda s: s["growth"]["channels"][0].update(cac=5), "growth", "spend / customers"),
    (lambda s: s["builder"].update(mvp_build_cost=5000), "builder", "MVP build cost"),
    (lambda s: s["economics"].update(delivery_cost_per_customer=60), "economics", "every sale loses money"),
    (lambda s: s["economics"].update(delivery_cost_per_customer=29), "economics", "break_even_customers"),
    (lambda s: s["growth"]["channels"][0].update(new_customers_per_month=10, cac=10), "growth", "Channels promise 10"),
])
def test_planted_contradictions_are_caught_and_owned(slices, profile, mutate, owner, needle):
    mutate(slices)
    findings = check_plan(slices, profile)
    assert any(f["owner"] == owner and needle in f["problem"] for f in findings), findings


def test_autofix_corrects_arithmetic_but_not_judgement(slices, profile):
    slices["economics"].update(monthly_burn=999, runway_months=30, break_even_customers=1)
    slices["economics"]["revenue_targets"][2]["mrr"] = 5000
    slices["growth"]["channels"][0]["cac"] = 5
    slices["economics"]["external_funding"] = 50000  # a judgement call: code must not "fix" it
    fixed = autofix_math(slices)
    assert len(fixed) == 5
    assert [f["owner"] for f in check_plan(slices, profile)] == ["economics"]
    assert slices["economics"]["monthly_burn"] == 160 and slices["economics"]["runway_months"] == 10


def test_financial_coherence_score_drops(slices, profile):
    engine = EvaluationEngine()
    assert engine.evaluate_financial_coherence(slices, profile)[0] == 1.0
    slices["economics"]["monthly_burn"] = 999
    assert engine.evaluate_financial_coherence(slices, profile)[0] < 1.0


def test_money_fields_accept_llm_strings(slices):
    econ = EconomicsSlice.model_validate(slices["economics"] | {"monthly_burn": "$1.2k/mo", "starting_capital": "₹40,000"})
    assert econ.monthly_burn == 1200 and econ.starting_capital == 40000


def test_full_graph_revises_only_the_agent_at_fault(slices, profile, monkeypatch):
    """Economics raises outside money while bootstrapped; only Economics re-runs, and Growth is
    skipped because the numbers it reads did not change."""
    calls = []
    bad = copy.deepcopy(slices["economics"]) | {"external_funding": 50000, "monthly_burn": 999}
    economics_outputs = [bad, slices["economics"]]

    def runner(owner, model):
        def run(state):
            calls.append(owner)
            if owner == "economics":
                if state["revision"] == 1:
                    assert any(i["owner"] == "economics" for i in state["issues"])  # feedback reached the agent
                return model.model_validate(economics_outputs.pop(0))
            return model.model_validate(slices[owner])
        return run

    monkeypatch.setattr(go, "RUNNERS", {
        "strategist": runner("strategist", StrategySlice),
        "builder": runner("builder", BuildSlice),
        "economics": runner("economics", EconomicsSlice),
        "growth": runner("growth", GrowthSlice),
    })
    monkeypatch.setattr(go.critic, "run", lambda state, math: (calls.append("critic"), CriticResult(
        issues=[], biggest_risk="Clinics may not trust SMS from an unknown vendor.",
        verdict="Viable if 4 clinics convert in 60 days.", adherence_score=0.9))[1])
    monkeypatch.setattr(go, "save_state", lambda *a, **k: None)
    monkeypatch.setattr(go, "get_lessons_from_db", lambda profile: [])

    final = go.run("SMS reminders for dental clinics", {"market": "US", "constraints": "bootstrapped"})

    assert calls == ["strategist", "builder", "economics", "growth", "critic", "economics", "critic"]
    assert final["revision"] == 1
    assert final["math_warnings"] == []
    assert final["business_plan"]["financial_snapshot"]["monthly_burn"] == "$160/mo"
    assert "## 4. Monthly Cost Breakdown" in final["final_report"]


def test_display_plan_and_report_render(slices, profile):
    state = {"startup_idea": "SMS reminders", "profile": profile, "slices": slices, "conflicts": [],
             "critic": {"verdict": "Viable if 4 clinics convert in 60 days.", "biggest_risk": "Clinics ignore cold calls."},
             "math_warnings": []}
    plan = build_display_plan(state)
    assert plan.revenue_targets[0].mrr == "$147 MRR"
    assert plan.go_to_market[0].startswith("Cold calls:")
    assert plan.financial_snapshot.break_even_target == "4 paying customers"
    assert plan.final_verdict.endswith("Biggest risk: Clinics ignore cold calls.")
    report = render_report(state)
    assert "- Day 90: 10 paying customers, $490 MRR" in report and "|" not in report
    assert "## 1. Tech Stack" in report


def test_service_business_gets_service_headings(slices, profile):
    slices["strategist"]["business_type"] = "service"
    state = {"startup_idea": "SMMA", "profile": profile, "slices": slices, "conflicts": [],
             "critic": {"verdict": "Viable with 2 pilot clients."}, "math_warnings": []}
    report = render_report(state)
    assert "## 1. Tools & Delivery Stack" in report and "## 3. First Offer" in report
    assert "Tech Stack" not in report


def test_failed_critic_review_still_finishes_the_plan(slices, monkeypatch):
    for owner, model in (("strategist", StrategySlice), ("builder", BuildSlice),
                         ("economics", EconomicsSlice), ("growth", GrowthSlice)):
        monkeypatch.setitem(go.RUNNERS, owner, lambda state, o=owner, m=model: m.model_validate(slices[o]))

    def boom(state, math):
        raise RuntimeError("[critic] could not produce valid JSON")

    monkeypatch.setattr(go.critic, "run", boom)
    monkeypatch.setattr(go, "save_state", lambda *a, **k: None)
    monkeypatch.setattr(go, "get_lessons_from_db", lambda profile: [])

    final = go.run("SMS reminders for dental clinics", {"market": "US", "constraints": "bootstrapped"})
    assert final["revision"] == 0
    assert "could not complete its review" in final["business_plan"]["final_verdict"]
