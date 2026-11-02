"""
Scores one finished plan. Pure functions on the final state's slices, so they are unit-tested and
give the same answer on any machine.

What each number means:
- math_warnings: arithmetic problems code could not fix (should be 0).
- catalog_share: share of costed tools that are in tool_knowledge.json, i.e. whose price we could check.
- hidden_costs: tools the Builder recommends (stack + AI tools) that never appear in tool_costs.
- invented_stats: percentages, view counts and "N x faster" style claims in prose that the founder
  never gave us. Not every hit is wrong, but each one is a number with no source.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

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


def catalog_names(path: Path = ROOT / "tool_knowledge.json") -> list[str]:
    kb = json.loads(path.read_text(encoding="utf-8"))
    return [t["name"] for cat in kb.get("categories", {}).values() for t in cat.get("tools", [])]


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


def invented_stats(slices: dict, founder_text: str) -> list[dict]:
    """Stat-like claims in prose whose number the founder never mentioned."""
    given = set(re.findall(r"\d[\d,.]*", founder_text))
    hits = []
    for where, text in prose_fields(slices):
        for m in _STAT.finditer(text or ""):
            number = re.match(r"\d[\d,.]*", m.group(0)) or re.search(r"\d[\d,.]*", m.group(0))
            if number and number.group(0) in given:
                continue
            hits.append({"where": where, "claim": m.group(0)})
    return hits


def hidden_costs(slices: dict) -> list[str]:
    """Recommended tools (stack + AI tools) with no line in tool_costs."""
    b = slices.get("builder", {})
    costed = [t.get("tool", "") for t in b.get("tool_costs", [])]
    named = [t.get("name", "") for t in b.get("stack", []) + b.get("ai_tools", [])]
    return [n for n in named if _words(n) and not any(same_tool(n, c) for c in costed)]


def catalog_share(slices: dict, catalog: list[str]) -> tuple[int, int]:
    """(costed tools found in the catalog, costed tools)."""
    costs = slices.get("builder", {}).get("tool_costs", [])
    return sum(1 for t in costs if any(same_tool(t.get("tool", ""), c) for c in catalog)), len(costs)


def score(final_state: dict, founder_text: str, catalog: list[str]) -> dict:
    slices = final_state.get("slices", {})
    in_catalog, costed = catalog_share(slices, catalog)
    stats = invented_stats(slices, founder_text)
    return {
        "revisions": final_state.get("revision", 0),
        "issues_raised": len(final_state.get("conflicts", [])),
        "math_warnings": len(final_state.get("math_warnings", [])),
        "tools_costed": costed,
        "tools_in_catalog": in_catalog,
        "hidden_costs": hidden_costs(slices),
        "invented_stats": stats,
        "plan_chars": len(json.dumps(slices, ensure_ascii=False)),
    }
