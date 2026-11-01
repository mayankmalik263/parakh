"""
Shared context for all MASS agents.

- build_profile(state): parses market/funding ONCE into a small dict (currency, caps).
- build_context_block(state): a short (~300 token) brief every agent receives.
- tool_knowledge(profile): the curated tool/price KB, sent to the Builder only.
"""

import json
import os
import re

_TOOL_KB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "tool_knowledge.json")

# Shared once via the system message instead of repeated self-check blocks per agent.
ANTI_FLUFF_RULES = """You are part of MASS, a team that turns a startup idea into a build plan a solo founder can start tonight.
Rules for everything you write:
- No generic phrases ("build an MVP", "do market research", "run social media ads", "leverage", "increase awareness"). Name the tool, the platform, the action and the number.
- Every tool is a real 2026 product with its real plan name and price. If unsure of a price, say "price not verified".
- Exact numbers everywhere a number belongs. Never "some", "a few", "several".
- A solo founder with AI coding tools (Cursor, v0, Claude Code) ships what a 5-person team did in 2020. Size plans accordingly.
- Stay inside your own section. Other agents own the other sections; use their numbers as fixed inputs."""

_INDIA = re.compile(r"\b(india|indian|inr|₹|delhi|mumbai|bangalore|bengaluru|dehradun|pune|hyderabad|chennai|kolkata)\b", re.I)
_BOOTSTRAP = re.compile(r"\bbootstrap", re.I)
_VENTURE = re.compile(r"\b(venture|vc|seed|angel|series a|funded)\b", re.I)


def build_profile(state: dict) -> dict:
    market = state.get("market") or "Global"
    constraints = state.get("constraints") or ""
    is_india = bool(_INDIA.search(f"{market} {state.get('startup_idea', '')}"))

    if _BOOTSTRAP.search(constraints):
        funding = "bootstrapped"
    elif _VENTURE.search(constraints):
        funding = "venture"
    else:
        funding = "unspecified"

    profile = {
        "market": market,
        "is_india": is_india,
        "currency": "INR" if is_india else "USD",
        "symbol": "₹" if is_india else "$",
        "funding": funding,
        "burn_cap": None,
        "mvp_cap": None,
    }
    if funding == "bootstrapped":
        profile["burn_cap"] = 30_000 if is_india else 500
        profile["mvp_cap"] = 40_000 if is_india else 500
    return profile


def _rules(profile: dict) -> list[str]:
    s = profile["symbol"]
    rules = [f"All money in {profile['currency']} ({s}). " + (
        "Indian benchmarks: UPI, Razorpay, Indian pricing power." if profile["is_india"]
        else "Global/US benchmarks: Stripe, US pricing power.")]
    if profile["funding"] == "bootstrapped":
        rules += [
            "Bootstrapped: no VC, no angels, no hires. Founder + AI tools + occasional freelancer.",
            f"MVP build cost under {s}{profile['mvp_cap']:,}. Monthly burn under {s}{profile['burn_cap']:,} before revenue.",
            "Ship in 2-4 weeks. Revenue starts in month 1 or 2.",
        ]
    elif profile["funding"] == "venture":
        rules += [
            "Venture-backed seed stage: lean elite team allowed, aggressive growth.",
            "Assume " + ("₹3Cr-₹5Cr" if profile["is_india"] else "$1M-$3M") + " for a 12-18 month runway.",
        ]
    else:
        rules.append("Funding not specified: assume a lean founder-funded start; ship within 4 weeks.")
    return rules


def get_lessons_from_db(profile: dict, limit: int = 5) -> list[str]:
    """Most recent lessons for this profile. Advisory only, capped in count and length."""
    try:
        from supabase_client import get_supabase
        tags = ["general", profile["funding"]] + (["india"] if profile["is_india"] else [])
        response = (
            get_supabase().table("agent_lessons").select("lesson")
            .in_("tag", tags).order("created_at", desc=True).limit(limit).execute()
        )
        return [item["lesson"][:300] for item in response.data or [] if item.get("lesson")]
    except Exception as e:
        print(f"[CONTEXT] Failed to retrieve lessons: {e}")
        return []


def build_context_block(state: dict) -> str:
    profile = state.get("profile") or build_profile(state)
    lessons = state.get("lessons")
    if lessons is None:
        lessons = get_lessons_from_db(profile)

    lines = [
        "CONTEXT",
        f"Startup idea   : {state.get('startup_idea', 'N/A')}",
        f"Market         : {profile['market']}",
        f"Target audience: {state.get('target_audience') or 'not specified'}",
        f"Revenue model  : {state.get('revenue_model') or 'not specified'}",
        f"Constraints    : {state.get('constraints') or 'none'}",
        "",
        "HARD RULES",
        *[f"- {r}" for r in _rules(profile)],
    ]
    if lessons:
        lines += ["", "PAST OBSERVATIONS (advisory, from earlier runs)", *[f"- {l}" for l in lessons]]
    return "\n".join(lines)


def slice_json(state: dict, owner: str) -> str:
    """An upstream agent's slice, as compact JSON, for use as fixed input."""
    return json.dumps(state["slices"].get(owner, {}), ensure_ascii=False, separators=(",", ":"))


def revision_block(state: dict, owner: str) -> str:
    """On a revision pass: this agent's previous output plus the issues addressed to it."""
    previous = state["slices"].get(owner)
    if not previous:
        return ""
    issues = [i for i in state.get("issues", []) if i["owner"] == owner]
    lines = ["", "REVISION PASS. Your previous output:", slice_json(state, owner)]
    if issues:
        lines.append("You MUST fix these issues:")
        lines += [f"- {i['problem']} -> FIX: {i['fix']}" for i in issues]
    else:
        lines.append("An upstream section changed. Keep your choices unless the new inputs force a change.")
    lines.append("Change only what is needed. Return the full corrected section.")
    return "\n".join(lines)


def tool_knowledge(profile: dict) -> str:
    """Compact curated tool/price list. Only the Builder needs it."""
    try:
        with open(_TOOL_KB_PATH, "r", encoding="utf-8") as f:
            kb = json.load(f)
    except Exception as e:
        print(f"[CONTEXT] Failed to load tool knowledge base: {e}")
        return ""

    india = profile["is_india"]
    lines = [f"CURATED TOOLS & PRICES (updated {kb.get('last_updated', '?')}). Prefer these; quote these prices."]
    for cat in kb.get("categories", {}).values():
        default = cat.get("recommended_default") or cat.get(
            "recommended_default_india" if india else "recommended_default_global", "")
        lines.append(f"{cat.get('label')} (default: {default})")
        # Only the default picks: the full list costs ~1,600 tokens per Builder call on the free tier.
        tools = cat.get("tools", [])
        picks = [t for t in tools if re.split(r"[ .]", t["name"])[0].lower() in default.lower()] or tools[:1]
        for tool in picks:
            price = f"free: {tool.get('free_tier') or '-'}"
            paid = tool.get("paid_tier") or tool.get("transaction_fee")
            if paid:
                price += f"; paid: {paid}"
            if india and tool.get("pricing_inr"):
                price += f"; INR: {tool['pricing_inr']}"
            cmd = f" [{tool['setup_command']}]" if tool.get("setup_command") and tool["name"] in default else ""
            lines.append(f"  - {tool['name']}: {price}{cmd}")
    return "\n".join(lines)
