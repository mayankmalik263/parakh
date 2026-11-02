"""Checked prices: code, not the model, decides what a tool costs."""
from agents.context_block import build_profile
from evaluation_engine import check_plan
from tool_catalog import catalog_prompt, find_tool, market_findings, monthly_cost, price_build

CATALOG = {
    "checked_on": "2026-11-02",
    "usd_to_inr": {"rate": 80, "source": "test", "as_of": "test"},
    "tools": [
        {"name": "Carrd", "plans": [{"plan": "Free", "period": "free"}, {"plan": "Pro Standard", "usd": 19, "period": "year"}],
         "source": "https://carrd.com/pro", "checked_on": "2026-11-02", "india": True, "for": ["service", "software"]},
        {"name": "Canva", "plans": [{"plan": "Free", "period": "free"}, {"plan": "Pro", "inr": 4000, "period": "year"}],
         "source": "https://canva.com", "checked_on": "2026-11-02", "india": True, "for": ["service"]},
        {"name": "Razorpay", "aliases": ["Razorpay Payment Links"], "plans": [{"plan": "Standard", "period": "usage", "usage": "2% + GST per payment"}],
         "source": "https://razorpay.com/pricing/", "checked_on": "2026-11-02", "india": True},
        {"name": "CapCut", "plans": [{"plan": "Pro", "usd": 19.99, "period": "month"}], "source": "x", "checked_on": "2026-11-02",
         "india": False, "india_note": "banned in India since 29 June 2020", "for": ["service"]},
        {"name": "Google Workspace", "aliases": ["Google Sheets", "Google Forms"], "plans": [{"plan": "Free", "period": "free"}],
         "source": "x", "checked_on": "2026-11-02", "india": True},
    ],
}
INDIA = {"currency": "INR", "symbol": "₹", "is_india": True}
US = {"currency": "USD", "symbol": "$", "is_india": False}


def test_yearly_prices_become_monthly_in_the_plan_currency():
    carrd = find_tool("Carrd Pro", CATALOG)
    pro = carrd["plans"][1]
    assert monthly_cost(pro, INDIA, CATALOG) == round(19 * 80 / 12)
    assert monthly_cost(pro, US, CATALOG) == round(19 / 12, 2)
    assert monthly_cost(find_tool("Canva", CATALOG)["plans"][1], INDIA, CATALOG) == 333


def test_builder_prices_are_replaced_and_uncosted_tools_are_added():
    build = {
        "stack": [{"name": "Carrd", "why": "site"}, {"name": "Google Sheets", "why": "orders"}, {"name": "Notion AI Wizard", "why": "x"}],
        "ai_tools": [{"name": "Canva", "why": "posters"}],
        "tool_costs": [{"tool": "Carrd", "plan": "Carrd Pro Standard", "monthly_cost": 333},
                       {"tool": "Razorpay Payment Links", "plan": "Pay as you go", "monthly_cost": 0}],
    }
    fixes = price_build(build, INDIA, CATALOG)
    by_tool = {t["tool"]: t for t in build["tool_costs"]}
    assert fixes == [{"label": "Carrd (Pro Standard)", "unit": "money", "before": 333, "after": 127}]
    assert by_tool["Carrd"]["verified"] and by_tool["Carrd"]["monthly_cost"] == 127
    assert by_tool["Razorpay Payment Links"]["verified"] and "2% + GST" in by_tool["Razorpay Payment Links"]["price_note"]
    # Recommended but never costed: a catalog tool gets its free plan, an unknown one is flagged.
    assert by_tool["Google Sheets"]["monthly_cost"] == 0 and by_tool["Google Sheets"]["verified"]
    assert by_tool["Canva"]["plan"] == "Free"
    assert by_tool["Notion AI Wizard"]["verified"] is False


def test_tool_banned_in_india_is_a_builder_issue_and_left_out_of_the_prompt():
    slices = {"builder": {"stack": [{"name": "CapCut Pro", "why": "edit"}], "ai_tools": [], "tool_costs": []}}
    found = market_findings(slices, INDIA, CATALOG)
    assert found and found[0]["owner"] == "builder" and "banned in India" in found[0]["problem"]
    assert market_findings(slices, US, CATALOG) == []
    assert "CapCut" not in catalog_prompt(INDIA, "service", CATALOG)
    assert "Canva: free; Pro ₹333/mo" in catalog_prompt(INDIA, "service", CATALOG)


def test_budget_and_ai_answers_reach_the_profile():
    p = build_profile({"startup_idea": "Notes for juniors", "market": "India",
                       "constraints": "Funding: Bootstrapped. Founder: Student. Budget: 5000-20000. AI: chatgpt, claude"})
    assert p["capital_range"] == [5000, 20000] and p["ai_paid"] == ["ChatGPT", "Claude"]
    p = build_profile({"startup_idea": "x", "market": "India", "constraints": "Budget: 100000+. AI: none"})
    assert p["capital_range"] == [100000, None] and p["ai_paid"] == []
    p = build_profile({"startup_idea": "Tiffin in Dehradun", "market": "India", "constraints": "Budget: about 15,000 rupees."})
    assert p["capital_range"] == [15000, 15000] and p["ai_paid"] is None


def test_starting_capital_outside_the_founders_budget_is_flagged(slices, profile):
    profile["capital_range"] = [0, 0]
    assert any("starting_capital" in f["problem"] for f in check_plan(slices, profile))
    profile["capital_range"] = [slices["economics"]["starting_capital"], None]
    assert not any("starting_capital" in f["problem"] for f in check_plan(slices, profile))


def test_a_catalog_alias_counts_as_costed():
    from tool_catalog import is_costed
    costs = [{"tool": "Google Workspace", "plan": "Free", "monthly_cost": 0}]
    assert is_costed("Google Sheets", costs, CATALOG) and not is_costed("Canva", costs, CATALOG)
