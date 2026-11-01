import json

from models import GrowthSlice
from .context_block import ANTI_FLUFF_RULES, build_context_block, revision_block, slice_json
from .llm_router import call_llm_json

# Hormozi offer clarity + Lemkin founder-led sales.
PERSONA = """You are GROWTH. You own ONLY: acquisition channels, the first-10-customers playbook, the cold message, objections.
You do NOT change prices, budget or targets; Economics owns them and they are fixed.
- 1-2 channels, deep not wide. Each names the exact platform, action and daily volume.
- sum(monthly_spend) across channels must be <= the marketing budget. cac = monthly_spend / new_customers_per_month (0 spend means 0 CAC).
- Channels together must deliver about the Day 30 paying-customer target per month: not less, and not more than 1.5x it.
- CAC must be below 3 months of avg_revenue_per_customer.
- First 10 customers: gritty, unscalable founder hustle (named communities, DMs, calls). Not "launch on Product Hunt".
- Cold message: 3 lines the founder can send today, written to the target customer.
- The founder is starting from zero: never invent past clients, results, testimonials or savings figures. Offer proof they can deliver instead (a free sample, a pilot, a guarantee)."""


def numbers(econ: dict) -> dict:
    """The Economics fields Growth works from."""
    return {k: econ[k] for k in ("pricing", "avg_revenue_per_customer", "marketing_budget", "revenue_targets")}


def run(state: dict) -> GrowthSlice:
    numbers_in = numbers(state["slices"]["economics"])
    prompt = f"""{build_context_block(state)}

STRATEGY (fixed input):
{slice_json(state, "strategist")}

ECONOMICS numbers (fixed input):
{json.dumps(numbers_in, ensure_ascii=False, separators=(",", ":"))}

{PERSONA}
All money in {state['profile']['currency']}.
{revision_block(state, "growth")}"""
    return call_llm_json(prompt, GrowthSlice, role="growth", system=ANTI_FLUFF_RULES)
