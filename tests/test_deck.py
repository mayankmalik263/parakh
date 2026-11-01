"""Deck critique: the claims checker (pure Python) and the reader/judge wiring (LLM faked)."""
import pytest

from evaluation_engine import check_claims, format_money

# A numbers slide with four planted mistakes: burn != line items, runway, MRR and CAC.
BROKEN = {
    "currency": "INR", "price_per_customer_monthly": 299, "monthly_burn": 40000,
    "burn_line_items": [{"item": "Rent", "monthly_cost": 15000}, {"item": "Salaries", "monthly_cost": 20000},
                        {"item": "Tools", "monthly_cost": 3000}],
    "cash_in_bank": 200000, "runway_months": 12, "current_paying_customers": 150, "current_mrr": 60000,
    "channels": [{"name": "Instagram ads", "monthly_spend": 10000, "new_customers_per_month": 50, "cac": 100}],
}


def errors(claims):
    return {(f["field"], f["computed"]) for f in check_claims(claims)[0] if f["severity"] == "error"}


def test_every_planted_mistake_is_caught_with_the_right_number():
    assert errors(BROKEN) == {("monthly_burn", 38000), ("runway_months", 5.0), ("current_mrr", 44850), ("channels", 200)}


def test_a_consistent_deck_has_no_errors():
    fixed = {**BROKEN, "monthly_burn": 38000, "runway_months": 5.3, "current_mrr": 44850, "delivery_cost_per_customer": 50,
             "channels": [{"name": "Instagram ads", "monthly_spend": 10000, "new_customers_per_month": 50, "cac": 200}]}
    findings, recomputed = check_claims(fixed)
    assert [f for f in findings if f["severity"] == "error"] == []
    assert {"label": "Paying customers to break even", "value": 153, "unit": "customers",
            "formula": "₹38,000 ÷ ₹249 margin per customer"} in recomputed


def test_missing_numbers_skip_checks_instead_of_guessing():
    findings, recomputed = check_claims({"currency": "INR", "runway_months": 18})
    assert findings == [] and recomputed == []


def test_runway_without_cash_is_a_warning():
    findings, _ = check_claims({"currency": "INR", "runway_months": 18, "monthly_burn": 20000})
    assert [f["severity"] for f in findings] == ["warning"]


def test_selling_below_cost_and_expensive_channels_are_flagged():
    findings, _ = check_claims({"currency": "INR", "price_per_customer_monthly": 99, "delivery_cost_per_customer": 120,
                                "channels": [{"name": "Google Ads", "cac": 450}]})
    fields = {(f["field"], f["severity"]) for f in findings}
    assert ("delivery_cost_per_customer", "error") in fields and ("channels", "warning") in fields


def test_break_even_and_raise_are_recomputed():
    claims = {"currency": "USD", "price_per_customer_monthly": 20, "delivery_cost_per_customer": 5, "monthly_burn": 3000,
              "cash_in_bank": 9000, "funding_ask": 30000, "break_even_customers": 50}
    findings, recomputed = check_claims(claims)
    assert ("break_even_customers", 200) in {(f["field"], f["computed"]) for f in findings}
    assert {r["label"]: r["value"] for r in recomputed}["Runway if the raise closes"] == 13.0


@pytest.mark.parametrize("value, currency, text", [
    (200000, "INR", "₹2,00,000"), (15000000, "INR", "₹1,50,00,000"), (999, "INR", "₹999"), (1234567, "USD", "$1,234,567")])
def test_money_uses_indian_grouping_for_rupees(value, currency, text):
    assert format_money(value, currency) == text


def test_images_go_to_the_vision_model_in_openai_format(monkeypatch):
    from types import SimpleNamespace

    from agents import deck_reader
    from agents import llm_router as r
    sent = []
    reply = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content='{"monthly_burn": "40k"}'))], usage=None)
    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=lambda **kw: sent.append(kw) or reply)))
    monkeypatch.setattr(r, "_get_client", lambda: client)
    claims = deck_reader.read_claims(["data:image/png;base64,AAAA"], "", "Notes app")
    assert claims.monthly_burn == 40000
    content = sent[0]["messages"][-1]["content"]
    assert sent[0]["model"] == r.VISION_MODEL
    assert content[0]["type"] == "text"
    assert content[1] == {"type": "image_url", "image_url": {"url": "data:image/png;base64,AAAA"}}


def test_a_model_that_refuses_images_gets_a_paste_text_hint(monkeypatch):
    from agents import deck_reader

    def refuse(*a, **k):
        raise RuntimeError("[vision] could not produce valid JSON: Error code: 400")
    monkeypatch.setattr(deck_reader, "call_llm_json", refuse)
    with pytest.raises(RuntimeError, match="Paste the numbers from your deck as text"):
        deck_reader.read_claims(["data:image/png;base64,AAAA"], "", "")


def test_math_is_still_returned_when_the_review_fails(monkeypatch):
    from agents import deck_reader
    from models import DeckClaims
    monkeypatch.setattr(deck_reader, "read_claims", lambda *a: DeckClaims.model_validate(BROKEN))

    def busy(*a):
        raise RuntimeError("busy")
    monkeypatch.setattr(deck_reader, "judge", busy)
    result = deck_reader.critique([], "numbers", "")
    assert result["verdict"] is None
    assert len([f for f in result["findings"] if f["severity"] == "error"]) == 4
