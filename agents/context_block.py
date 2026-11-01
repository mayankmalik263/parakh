"""
Shared context for all Parakh agents.

- build_profile(state): parses market/funding ONCE into a small dict (currency, caps).
- build_context_block(state): a short (~300 token) brief every agent receives.
- tool_knowledge(profile): the curated tool/price KB, sent to the Builder only.
"""

import json
import os
import re

_TOOL_KB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "tool_knowledge.json")

# Shared once via the system message instead of repeated self-check blocks per agent.
ANTI_FLUFF_RULES = """You are part of Parakh, a team that turns a startup idea into a build plan a solo founder can start tonight.
Rules for everything you write:
- No generic phrases ("build an MVP", "do market research", "run social media ads", "leverage", "increase awareness"). Name the tool, the platform, the action and the number.
- Every tool is a real 2026 product with its real plan name and price. If unsure of a price, say "price not verified".
- Exact numbers everywhere a number belongs. Never "some", "a few", "several".
- A solo founder with AI coding tools (Cursor, v0, Claude Code) ships what a 5-person team did in 2020. Size plans accordingly.
- Stay inside your own section. Other agents own the other sections; use their numbers as fixed inputs."""

_INDIA = re.compile(
    r"(₹|\b(india|indian|inr|bharat|upi|delhi|ncr|noida|gurgaon|gurugram|mumbai|bangalore|bengaluru|dehradun|pune|"
    r"hyderabad|chennai|kolkata|jaipur|lucknow|chandigarh|ahmedabad|indore|bhopal|kochi|rohtak|patna)\b)", re.I)
# Somewhere else named outright: don't assume India for these.
_ELSEWHERE = re.compile(
    r"\b(usa|u\.s\.a?|united states|america|american|uk|united kingdom|britain|europe|european|canada|australia|"
    r"dubai|uae|singapore|germany|worldwide)\b|\bglobal market\b|\bglobal (customers|users|audience)\b", re.I)
_UNSET_MARKET = {"", "not specified", "none", "unspecified", "any"}
_BOOTSTRAP = re.compile(r"\bbootstrap", re.I)
_VENTURE = re.compile(r"\b(venture|vc|seed|angel|series a|funded)\b", re.I)
# Explicit markers the frontend adds from the clarify answers. They beat keyword guessing, because the
# free-text context also carries the question wording ("Bootstrapped or Venture Backed?").
_FUNDING_MARK = re.compile(r"\bfunding:\s*(bootstrapped|venture)", re.I)
_FOUNDER_MARK = re.compile(r"\bfounder:\s*(student|full-time|professional)", re.I)
_NOT_STUDENT = re.compile(r"\b(not a student|full[- ]time founder|working professional|side project from my job)\b", re.I)

# Caps for a bootstrapped founder before revenue, in the plan currency. A student funds the start from
# savings and pocket money, so their caps are tighter than an Indian founder working full time.
CAPS = {
    "student_india": {"mvp_cap": 15_000, "burn_cap": 10_000},
    "india": {"mvp_cap": 40_000, "burn_cap": 30_000},
    "global": {"mvp_cap": 500, "burn_cap": 500},
}


def build_profile(state: dict) -> dict:
    """
    Parakh is built for Indian student founders, so that is the default: a blank market means India,
    and an Indian founder who doesn't say otherwise is a bootstrapped student. Anything the founder
    states (another country, venture funding, working full time) overrides the default.
    """
    raw_market = (state.get("market") or "").strip()
    constraints = state.get("constraints") or ""
    idea = state.get("startup_idea", "")

    market_unset = raw_market.lower() in _UNSET_MARKET
    if _INDIA.search(f"{raw_market} {idea}"):
        is_india = True
    elif market_unset:
        is_india = not _ELSEWHERE.search(f"{idea} {constraints}")
    else:
        is_india = False
    market = raw_market if not market_unset else ("India" if is_india else "Global")

    marked = _FUNDING_MARK.search(constraints)
    if marked:
        funding = marked.group(1).lower()
    elif _BOOTSTRAP.search(constraints):
        funding = "bootstrapped"
    elif _VENTURE.search(constraints):
        funding = "venture"
    else:
        funding = "bootstrapped" if is_india else "unspecified"

    # Student mode is the Indian student founder: it changes caps, channels and pricing to India's.
    founder = _FOUNDER_MARK.search(constraints)
    if founder:
        student = founder.group(1).lower() == "student"
    else:
        student = not _NOT_STUDENT.search(constraints)
    student = student and is_india and funding == "bootstrapped"

    profile = {
        "market": market,
        "is_india": is_india,
        "currency": "INR" if is_india else "USD",
        "symbol": "₹" if is_india else "$",
        "funding": funding,
        "student": student,
        "burn_cap": None,
        "mvp_cap": None,
    }
    if funding == "bootstrapped":
        tier = "global" if not is_india else ("student_india" if student else "india")
        profile.update(CAPS[tier])
    return profile


def _rules(profile: dict) -> list[str]:
    s = profile["symbol"]
    rules = [f"All money in {profile['currency']} ({s}). " + (
        "Indian benchmarks: UPI, Razorpay, Indian pricing power." if profile["is_india"]
        else "Global/US benchmarks: Stripe, US pricing power.")]
    if profile.get("student"):
        rules += [
            "Founder: a student in India, building nights and weekends (about 15 hours a week) around classes and exams. "
            "No VC, no hires, no office. Batchmates or a friend can help part time.",
            f"Money: starting capital is the founder's own savings, usually {s}5,000-{s}25,000 unless they said otherwise. "
            f"MVP build cost under {s}{profile['mvp_cap']:,}. Monthly burn under {s}{profile['burn_cap']:,} before revenue.",
            "Free tiers and student offers first (GitHub Student Developer Pack, Supabase and Netlify free tiers, Canva free). "
            "Pay for a tool only once a customer pays.",
            "Payments: UPI and Razorpay payment links. Indian students and consumers pay tens to a few hundred rupees a month; "
            "small local businesses pay a few hundred to a few thousand rupees a month for something that clearly saves time or brings customers.",
            "Customers and channels: campus first. Batchmates, seniors and juniors, college clubs and fests, class and hostel WhatsApp groups, "
            "Instagram, LinkedIn, alumni, and shops or businesses near campus.",
            "Timeline: ship in 3-4 weeks, first paying customer within 6 weeks. Leave exam weeks out of the plan.",
        ]
    elif profile["funding"] == "bootstrapped":
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
        tags = ["general"] + ([profile["funding"]] if profile["funding"] != "unspecified" else []) + (["india"] if profile["is_india"] else [])
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
