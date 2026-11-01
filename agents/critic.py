import json

from models import CriticResult
from .context_block import build_context_block
from .llm_router import call_llm_json

PERSONA = """You are the CRITIC, an independent reviewer. You did not write this plan and you owe it nothing.
The arithmetic has already been checked by code; those findings are listed below and will be fixed anyway. Do NOT repeat them.
Judge only what code cannot:
1. Fidelity: is this still the business in "Startup idea"? If the core offering was swapped (e.g. a social media agency became an SEO agency), that is a strategist issue.
2. Fit to business type: a service business needs delivery tools, pilots and contracts, not an app build; a physical product needs sourcing and samples.
3. Constraint fit: does anything break the HARD RULES (funding mode, currency, caps, market)?
4. Realism: would this price, this channel and these targets survive contact with the real target customer?
   A founder with no track record rarely closes high-ticket deals in 30 days. delivery_cost_per_customer must cover the real work delivered.
5. Coherence: do strategy, build and growth describe the same business for the same customer?
6. Vagueness: any action a founder could not start within 60 minutes without asking a follow-up question?
7. Founder fit: if the HARD RULES describe a student founder, does the plan fit about 15 hours a week, a savings-sized budget,
   and a campus-first launch? Plans that need a team, an office, paid ads at scale or months of full-time work are blocking issues.
Raise an issue ONLY if it is blocking, i.e. the founder would make a bad decision or get stuck. Address each issue to the one agent who owns that field:
strategist (business type, problem, customer, mission, competitors, scope cuts), builder (stack, tools, tool costs, steps),
economics (pricing, delivery cost, burn, capital, runway, targets), growth (channels, CAC, playbook, message, objections).
At most 4 issues, each problem in one or two sentences. An empty list is fine for a sound plan, but biggest_risk is always required: never call a plan risk-free."""


def run(state: dict, math_findings: list[dict]) -> CriticResult:
    plan = json.dumps(state["slices"], ensure_ascii=False, separators=(",", ":"))
    found = "\n".join(f"- [{f['owner']}] {f['problem']}" for f in math_findings) or "- none"
    # The Critic judges against the HARD RULES only; past lessons are advice for the planners, not law.
    prompt = f"""{build_context_block({**state, "lessons": []})}

PLAN (JSON, one section per agent):
{plan}

ARITHMETIC FINDINGS FROM CODE (already queued for fixing):
{found}

{PERSONA}"""
    return call_llm_json(prompt, CriticResult, role="critic", max_tokens=4000)
