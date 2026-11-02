"""
Checked tool prices, so plans quote real numbers instead of what a model remembers.

tool_catalog.json lists tools with plan prices, the page each price was read from and the day it
was checked. The Builder picks tools; this module then:
  - writes the catalog price into each tool_costs line it recognises (verified=True),
  - adds a cost line for every recommended tool the Builder forgot to cost,
  - marks prices it can't check (verified=False), and
  - reports tools that can't be used in the founder's market (e.g. CapCut in India).
Prices are converted to the plan currency with the catalog's dated exchange rate.
"""
import json
import re
from functools import lru_cache
from pathlib import Path

CATALOG_PATH = Path(__file__).resolve().parent / "tool_catalog.json"

# Plan words that say nothing about which product it is.
_NOISE = {"pro", "plus", "premium", "free", "annual", "yearly", "monthly", "plan", "tier", "app", "the", "and", "for"}


@lru_cache(maxsize=1)
def load_catalog(path: str = str(CATALOG_PATH)) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _words(name: str) -> tuple[str, ...]:
    return tuple(w for w in re.findall(r"[a-z0-9]+", (name or "").lower()) if w not in _NOISE)


def _same(a: str, b: str) -> bool:
    """One name's words start the other's: "Razorpay" ~ "Razorpay Payment Links", not "Google Drive" ~ "Google Forms"."""
    wa, wb = _words(a), _words(b)
    if not wa or not wb:
        return False
    n = min(len(wa), len(wb))
    return wa[:n] == wb[:n]


def find_tool(name: str, catalog: dict | None = None) -> dict | None:
    catalog = catalog or load_catalog()
    best = None
    for tool in catalog["tools"]:
        for candidate in [tool["name"], *tool.get("aliases", [])]:
            if _same(name, candidate):
                # Prefer the longest match: "Google Workspace Business" over "Google Workspace".
                if best is None or len(_words(candidate)) > best[0]:
                    best = (len(_words(candidate)), tool)
    return best[1] if best else None


def find_plan(tool: dict, plan_text: str, stated_cost: float | None = None) -> dict | None:
    """The catalog plan named in the Builder's plan text, e.g. "Supabase Pro" -> Pro."""
    text = set(re.findall(r"[a-z0-9]+", (plan_text or "").lower()))
    scored = []
    for plan in tool["plans"]:
        words = re.findall(r"[a-z0-9]+", plan["plan"].lower())
        if words and all(w in text for w in words):
            scored.append((len(words), plan))
    if scored:
        return max(scored, key=lambda s: s[0])[1]
    if len(tool["plans"]) == 1:
        return tool["plans"][0]
    if stated_cost == 0:
        # "Pay as you go", "Free tier": the free plan, else the pay-per-use one.
        return next((p for kind in ("free", "usage") for p in tool["plans"] if p["period"] == kind), None)
    return None


def monthly_cost(plan: dict, profile: dict, catalog: dict | None = None) -> float | None:
    """A plan's fixed monthly cost in the plan currency. Usage-priced plans cost 0 a month up front."""
    catalog = catalog or load_catalog()
    period = plan["period"]
    if period in ("free", "usage", "one_time"):
        # Pay-per-use and one-off purchases carry no fixed monthly cost; their note says what they cost.
        return 0.0
    rate = catalog["usd_to_inr"]["rate"]
    want_inr = profile.get("currency") == "INR"
    if want_inr:
        amount = plan.get("inr") if plan.get("inr") is not None else (plan["usd"] * rate if plan.get("usd") is not None else None)
    else:
        amount = plan.get("usd") if plan.get("usd") is not None else (plan["inr"] / rate if plan.get("inr") is not None else None)
    if amount is None:
        return None
    if period == "year":
        amount /= 12
    return round(amount, 0 if want_inr else 2)


def _default_plan(tool: dict) -> dict | None:
    """Free if there is a free plan, else usage-based, else the cheapest fixed plan."""
    for kind in ("free", "usage"):
        plan = next((p for p in tool["plans"] if p["period"] == kind), None)
        if plan:
            return plan
    fixed = [p for p in tool["plans"] if p.get("usd") is not None or p.get("inr") is not None]
    return min(fixed, key=lambda p: (p.get("usd") or 0) + (p.get("inr") or 0) / 100) if fixed else None


def _note(tool: dict, plan: dict, profile: dict | None = None) -> str:
    checked = tool.get("checked_on") or "?"
    usage = f"{plan['usage']}. " if plan.get("usage") else ""
    converted = ""
    if profile and plan["period"] in ("month", "year"):
        if profile.get("currency") == "INR" and plan.get("inr") is None and plan.get("usd") is not None:
            converted = f" (${plan['usd']:g}/{plan['period']}, converted to rupees)"
        elif profile.get("currency") == "USD" and plan.get("usd") is None and plan.get("inr") is not None:
            converted = f" (₹{plan['inr']:,.0f}/{plan['period']}, converted to dollars)"
    return f"{usage}Price checked {checked} on {tool['source']}{converted}"


def price_build(build: dict, profile: dict, catalog: dict | None = None) -> list[dict]:
    """
    Writes checked prices into build["tool_costs"] in place and adds lines for uncosted tools.
    Returns the corrections, in the same shape autofix_math uses: [{label, unit, before, after}].
    """
    catalog = catalog or load_catalog()
    fixes = []
    costs = build.setdefault("tool_costs", [])
    for line in costs:
        tool = find_tool(line.get("tool", ""), catalog)
        plan = find_plan(tool, f"{line.get('tool', '')} {line.get('plan', '')}", line.get("monthly_cost")) if tool else None
        price = monthly_cost(plan, profile, catalog) if plan else None
        if price is None:
            line["verified"] = False
            line["price_note"] = "Not in Parakh's checked price list. Confirm the price before you pay."
            continue
        if abs((line.get("monthly_cost") or 0) - price) > max(1, 0.02 * price):
            fixes.append({"label": f"{line['tool']} ({plan['plan']})", "unit": "money", "before": line.get("monthly_cost") or 0, "after": price})
            line["monthly_cost"] = price
        line["verified"] = True
        line["price_note"] = _note(tool, plan, profile)

    named = [t.get("name", "") for t in build.get("stack", []) + build.get("ai_tools", [])]
    for name in named:
        if not _words(name) or is_costed(name, costs, catalog):
            continue
        tool = find_tool(name, catalog)
        plan = _default_plan(tool) if tool else None
        price = monthly_cost(plan, profile, catalog) if plan else None
        if price is None:
            costs.append({"tool": name, "plan": "not stated", "monthly_cost": 0, "verified": False,
                          "price_note": "Recommended without a price. Check whether it is free before you rely on it."})
        else:
            costs.append({"tool": name, "plan": plan["plan"], "monthly_cost": price, "verified": True,
                          "price_note": _note(tool, plan, profile), "added_by_code": True})
    return fixes


def is_costed(name: str, costs: list[dict], catalog: dict | None = None) -> bool:
    """A recommended tool is costed if a cost line names it, or names the same catalog product
    ("Google Sheets" is covered by a "Google Workspace" line)."""
    if any(_same(name, c.get("tool", "")) for c in costs):
        return True
    tool = find_tool(name, catalog)
    return bool(tool) and any(find_tool(c.get("tool", ""), catalog) is tool for c in costs)


def market_findings(slices: dict, profile: dict, catalog: dict | None = None) -> list[dict]:
    """Tools the plan uses that the founder can't use in their market."""
    catalog = catalog or load_catalog()
    build = slices.get("builder") or {}
    names = [t.get("name", "") for t in build.get("stack", []) + build.get("ai_tools", [])]
    names += [t.get("tool", "") for t in build.get("tool_costs", [])]
    findings, seen = [], set()
    for name in names:
        tool = find_tool(name, catalog)
        if not tool or tool["name"] in seen:
            continue
        seen.add(tool["name"])
        if profile.get("is_india") and tool.get("india") is False:
            findings.append({"owner": "builder", "source": "math",
                             "problem": f"{tool['name']} can't be used in India: {tool.get('india_note', 'not available there')}.",
                             "fix": f"Replace {tool['name']} with a tool that works in India (see the TOOLS list)."})
    return findings


def catalog_prompt(profile: dict, business_type: str, catalog: dict | None = None) -> str:
    """The checked tools for this kind of business, one line each, for the Builder's prompt."""
    catalog = catalog or load_catalog()
    india = profile.get("is_india")
    lines = [f"TOOLS WITH CHECKED PRICES (checked {catalog['checked_on']}). Prefer these and use these exact names; "
             "code fills in their prices. Any other tool is shown to the founder as 'price not verified'."]
    for tool in catalog["tools"]:
        if business_type not in tool.get("for", ["software", "service", "physical"]):
            continue
        if india and tool.get("india") is False:
            continue
        plans = []
        for p in tool["plans"]:
            price = monthly_cost(p, profile, catalog)
            if p["period"] == "free":
                plans.append("free" if p["plan"].lower() == "free" else f"{p['plan']} free")
            elif p["period"] in ("usage", "one_time"):
                plans.append(f"{p['plan']} ({p.get('usage', 'pay per use')})")
            elif price is not None:
                plans.append(f"{p['plan']} {profile['symbol']}{price:,.0f}/mo")
        lines.append(f"- {tool['name']}: {'; '.join(plans) or 'price not listed'}. {tool.get('use_for', '')}".rstrip())
    return "\n".join(lines)
