"""
Builds the final outputs from the agents' JSON slices. Pure Python, no LLM call:
the numbers in the report are exactly the numbers the math checker verified.
"""
from models import StartupBusinessPlan


def _money(profile: dict, amount: float) -> str:
    return f"{profile['symbol']}{amount:,.0f}"


def _customers(n: int) -> str:
    return f"{n} paying customer{'' if n == 1 else 's'}"


def _verdict(critic: dict) -> str:
    risk = critic.get("biggest_risk")
    return critic.get("verdict", "") + (f"\n\nBiggest risk: {risk}" if risk else "")


# Section titles that only make sense for software get service/physical wording.
_HEADINGS = {
    "software": ("Tech Stack", "MVP Scope", "One-time MVP build cost"),
    "service": ("Tools & Delivery Stack", "First Offer", "One-time setup cost"),
    "physical": ("Store & Fulfilment Stack", "First Products", "One-time setup & inventory cost"),
}


_BILLING = {"monthly": "/mo", "one_time": " one-time", "per_use": " per use"}


def _tier_price(m, tier: dict) -> str:
    return f"{m(tier['monthly_price'])}{_BILLING.get(tier.get('billing', 'monthly'), '/mo')}"


def build_display_plan(state: dict) -> StartupBusinessPlan:
    """The plan shape the frontend renders (strings), derived from the slices."""
    p = state["profile"]
    s, b, e, g = (state["slices"][k] for k in ("strategist", "builder", "economics", "growth"))
    m = lambda x: _money(p, x)

    funding = e["external_funding"]
    return StartupBusinessPlan(
        startup_idea=state["startup_idea"],
        mission=s["mission"],
        problem=s["problem"],
        target_customer=s["target_customer"],
        business_model=[
            {"name": t["name"], "price": _tier_price(m, t), "features": t["features"]}
            for t in e["pricing"]
        ],
        financial_snapshot={
            "monthly_burn": f"{m(e['monthly_burn'])}/mo",
            "burn_breakdown": "; ".join(f"{i['item']}: {m(i['monthly_cost'])}" for i in e["burn_line_items"]),
            "funding_needed": f"{m(funding)} external" if funding else f"{m(e['starting_capital'])} founder capital",
            "runway": f"{e['runway_months']:.1f} months",
            "break_even_target": _customers(e["break_even_customers"]),
        },
        go_to_market=[f"{c['name']}: {c['tactic']}" for c in g["channels"]] + g["first_10_customers"],
        product_mvp=b["mvp_features"] + b["first_10_steps"],
        revenue_targets=[
            {"day": t["day"], "mrr": f"{m(t['mrr'])} MRR", "notes": f"{_customers(t['paying_customers'])}. {t['notes']}".strip()}
            for t in sorted(e["revenue_targets"], key=lambda t: t["day"])
        ],
        competition=s["competitors"],
        tools=[{"name": t["tool"], "plan": t["plan"], "monthly_cost": f"{m(t['monthly_cost'])}/mo",
                "verified": bool(t.get("verified")), "note": t.get("price_note", "")} for t in b["tool_costs"]],
        key_conflicts=[
            {"title": f"{c['owner'].title()}: {c['problem'][:120]}",
             "description": f"{'Minor: ' if c.get('severity') == 'minor' else ''}{c['problem']} Fix: {c['fix']}"}
            for c in state["conflicts"]
        ],
        final_verdict=_verdict(state["critic"]),
    )


def render_report(state: dict) -> str:
    """Markdown build plan for the 'raw report' view and saved .txt."""
    p = state["profile"]
    s, b, e, g = (state["slices"][k] for k in ("strategist", "builder", "economics", "growth"))
    m = lambda x: _money(p, x)
    stack_title, scope_title, setup_label = _HEADINGS.get(s.get("business_type"), _HEADINGS["software"])

    lines = [
        f"# Build Plan: {state['startup_idea']}",
        "",
        f"**Mission:** {s['mission']}",
        f"**Problem:** {s['problem']}",
        f"**Target customer:** {s['target_customer']}",
        "",
        f"## 1. {stack_title}",
        *[f"- **{i['name']}**: {i['why']}" for i in b["stack"]],
        "",
        "## 2. AI Tools for Fast Execution",
        *[f"- **{i['name']}**: {i['why']}" for i in b["ai_tools"]],
        "",
        f"## 3. {scope_title}",
        *[f"{n}. {f}" for n, f in enumerate(b["mvp_features"], 1)],
        "",
        "**Deliberately not building:**",
        *[f"- {c}" for c in s["scope_cuts"]],
        "",
        "## 4. Monthly Cost Breakdown",
        *[f"- {i['item']}: {m(i['monthly_cost'])}" for i in e["burn_line_items"]],
        f"- **Total monthly burn: {m(e['monthly_burn'])}**",
        f"- {setup_label}: {m(b['mvp_build_cost'])}",
        "",
        "**Tool prices:**",
        *[f"- {t['tool']} ({t['plan']}): {m(t['monthly_cost'])}/mo, "
          + ("checked" if t.get("verified") else "price not verified") for t in b["tool_costs"]],
        "",
        "## 5. Pricing & Unit Economics",
        *[f"- **{t['name']}** {_tier_price(m, t)}: {', '.join(t['features'])}" for t in e["pricing"]],
        f"- Avg revenue per paying customer: {m(e['avg_revenue_per_customer'])}/mo",
        f"- Delivery cost per customer: {m(e['delivery_cost_per_customer'])}/mo",
        f"- Break-even: {_customers(e['break_even_customers'])}",
        f"- Runway: {e['runway_months']:.1f} months on {m(e['starting_capital'])} starting capital"
        + (f" ({m(e['external_funding'])} external)" if e["external_funding"] else ""),
        "",
        "**Targets:**",
        *[f"- Day {t['day']}: {_customers(t['paying_customers'])}, {m(t['mrr'])} MRR" for t in sorted(e["revenue_targets"], key=lambda t: t["day"])],
        "",
        "**Assumptions:**",
        *[f"- {a}" for a in e["key_assumptions"]],
        "",
        "## 6. First 10 Steps (Starting Today)",
        *[f"{n}. {step}" for n, step in enumerate(b["first_10_steps"], 1)],
        "",
        "## 7. Getting the First Customers",
        *[f"- **{c['name']}** ({m(c['monthly_spend'])}/mo, ~{c['new_customers_per_month']} customers/mo, CAC {m(c['cac'])}): {c['tactic']}"
          for c in g["channels"]],
        "",
        *[f"{n}. {step}" for n, step in enumerate(g["first_10_customers"], 1)],
        "",
        "**Cold message:**",
        "",
        *[f"> {line}" for line in g["cold_message"].splitlines() if line.strip()],
        "",
        "**Objections:**",
        *[f"- *\"{o['objection']}\"*: {o['response']}" for o in g["objections"]],
        "",
        "## 8. Competition",
        *[f"- **{c['name']}**: {c['differentiator']}" for c in s["competitors"]],
        "",
        "## 9. Verdict",
        _verdict(state["critic"]),
    ]
    if state["math_warnings"]:
        lines += ["", "## Unresolved Math Warnings", *[f"- {w}" for w in state["math_warnings"]]]
    return "\n".join(lines)
