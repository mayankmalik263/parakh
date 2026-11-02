"""
Scores one finished plan. Pure functions on the final state's slices, so they are unit-tested and
give the same answer on any machine.

What each number means:
- math_warnings: arithmetic problems code could not fix (should be 0).
- tools_in_catalog: tool cost lines whose price matches tool_catalog.json (tool, plan and amount).
- hidden_costs: tools the Builder recommends (stack + AI tools) that never appear in tool_costs.
- invented_stats: percentages, view counts and "N x faster" style claims in prose that the founder
  never gave us. Not every hit is wrong, but each one is a number with no source.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
import sys  # noqa: E402
sys.path.insert(0, str(ROOT))

# "40%", "500+ views", "3x", "10x faster", "saves 30 minutes", "2.5 lakh views"
_STAT = re.compile(
    r"\b\d[\d,.]*\s*(?:%|percent\b)"
    r"|\b\d[\d,.]*\s*\+?\s*(?:k\s+)?(?:views|followers|likes|downloads|impressions|reach)\b"
    r"|\b\d+(?:\.\d+)?\s*x\b(?:\s+(?:faster|more|cheaper|better))?"
    r"|\bsav(?:e|es|ing)\s+(?:up to\s+)?\d[\d,.]*\s*(?:minutes|hours|mins|hrs)\b",
    re.I,
)


_NOISE = {"pro", "plus", "premium", "free", "annual", "monthly", "plan", "tier", "app", "the"}


def _words(name: str) -> tuple[str, ...]:
    """Lowercased words of a tool name, without plan words: "CapCut Pro (Annual)" -> ("capcut",)."""
    return tuple(w for w in re.findall(r"[a-z0-9]+", (name or "").lower()) if w not in _NOISE)


def same_tool(a: str, b: str) -> bool:
    """True if one name's words start the other's: "Razorpay" ~ "Razorpay Payment Links",
    but "Google Drive" is not "Google Forms"."""
    wa, wb = _words(a), _words(b)
    if not wa or not wb:
        return False
    n = min(len(wa), len(wb))
    return wa[:n] == wb[:n]


def prose_fields(slices: dict) -> list[tuple[str, str]]:
    """(where, text) for every free-text field a founder reads as fact."""
    s, b, g = slices.get("strategist", {}), slices.get("builder", {}), slices.get("growth", {})
    out = [("strategist.problem", s.get("problem", "")), ("strategist.target_customer", s.get("target_customer", ""))]
    out += [(f"strategist.competitor:{c.get('name')}", c.get("differentiator", "")) for c in s.get("competitors", [])]
    out += [(f"builder.stack:{t.get('name')}", t.get("why", "")) for t in b.get("stack", [])]
    out += [(f"builder.ai_tools:{t.get('name')}", t.get("why", "")) for t in b.get("ai_tools", [])]
    out += [(f"growth.channel:{c.get('name')}", c.get("tactic", "")) for c in g.get("channels", [])]
    out += [(f"growth.objection:{o.get('objection')}", o.get("response", "")) for o in g.get("objections", [])]
    out += [("growth.cold_message", g.get("cold_message", ""))]
    return out


def _catalog_text() -> str:
    data = json.loads((ROOT / "tool_catalog.json").read_text(encoding="utf-8"))
    return json.dumps([[p.get("usage", "") for p in t["plans"]] + [t.get("use_for", "")] for t in data["tools"]]).replace(" ", "")


def invented_stats(slices: dict, founder_text: str) -> list[dict]:
    """Stat-like claims in prose whose number the founder never mentioned."""
    given = set(re.findall(r"\d[\d,.]*", founder_text))
    hits = []
    for where, text in prose_fields(slices):
        for m in _STAT.finditer(text or ""):
            number = re.match(r"\d[\d,.]*", m.group(0)) or re.search(r"\d[\d,.]*", m.group(0))
            if number and number.group(0) in given:
                continue
            # The plan's own offers and promises are decisions, not facts about the world:
            # "50% off", "20% discount", "100% refund", "50% advance".
            after = text[m.end():m.end() + 14].lower()
            if re.match(r"\s*(off|discount|cashback|refund|advance|upfront|deposit)\b", after):
                continue
            if m.group(0).startswith("100") and "%" in m.group(0):
                continue
            # Fees from Parakh's checked price list ("2% + GST" for Razorpay) are sourced, not invented.
            if m.group(0).replace(" ", "") in _catalog_text():
                continue
            hits.append({"where": where, "claim": m.group(0)})
    return hits


def hidden_costs(slices: dict) -> list[str]:
    """Recommended tools (stack + AI tools) with no line in tool_costs."""
    import tool_catalog as tc
    b = slices.get("builder", {})
    costs = b.get("tool_costs", [])
    named = [t.get("name", "") for t in b.get("stack", []) + b.get("ai_tools", [])]
    return [n for n in named if _words(n) and not tc.is_costed(n, costs)]


def correct_prices(slices: dict, profile: dict) -> tuple[int, int, int, int]:
    """(lines whose monthly cost matches Parakh's checked price, lines, paid lines that match, paid lines).
    A line counts only if the tool and plan are in tool_catalog.json and the number agrees."""
    import tool_catalog as tc
    costs = slices.get("builder", {}).get("tool_costs", [])
    right = paid = paid_right = 0
    for line in costs:
        stated = line.get("monthly_cost") or 0
        tool = tc.find_tool(line.get("tool", ""))
        plan = tc.find_plan(tool, f"{line.get('tool', '')} {line.get('plan', '')}", stated) if tool else None
        price = tc.monthly_cost(plan, profile) if plan else None
        ok = price is not None and abs(stated - price) <= tc._tolerance(price, profile)
        right += ok
        # Paid lines are the ones that matter: a free tool at 0 is easy to get right.
        if stated > 0 or (price or 0) > 0:
            paid += 1
            paid_right += ok
    return right, len(costs), paid_right, paid


def score(final_state: dict, founder_text: str, profile: dict) -> dict:
    slices = final_state.get("slices", {})
    in_catalog, costed, paid_right, paid = correct_prices(slices, profile)
    stats = invented_stats(slices, founder_text)
    return {
        "revisions": final_state.get("revision", 0),
        "issues_raised": len(final_state.get("conflicts", [])),
        "math_warnings": len(final_state.get("math_warnings", [])),
        "tools_costed": costed,
        "tools_in_catalog": in_catalog,
        "paid_prices_right": paid_right,
        "paid_prices": paid,
        "hidden_costs": hidden_costs(slices),
        "invented_stats": stats,
        "plan_chars": len(json.dumps(slices, ensure_ascii=False)),
    }
