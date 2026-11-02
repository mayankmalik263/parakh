from models import EconomicsSlice
from .context_block import ANTI_FLUFF_RULES, build_context_block, revision_block, slice_json
from .llm_router import call_llm_json

# Naval-style: every number is a judgement with a stated assumption.
PERSONA = """You are ECONOMICS. You own EVERY number in the plan: pricing, burn, marketing budget, capital, runway, break-even, Day 30/60/90 targets.
Your arithmetic is checked by code afterwards, so it must hold exactly:
- monthly_burn = sum(burn_line_items). Include EVERY Builder tool cost as its own line item, plus one line item for the marketing budget.
- runway_months = starting_capital / monthly_burn (one decimal).
- delivery_cost_per_customer: what it costs each month to serve ONE paying customer (freelancer hours, per-client tool seats,
  API usage, goods and shipping). Price the real deliverables in the pricing tiers. Never 0 for a service or physical business.
- break_even_customers = ceil(monthly_burn / (avg_revenue_per_customer - delivery_cost_per_customer)).
- For each revenue target: mrr = paying_customers x avg_revenue_per_customer. MRR never decreases.
- pricing: each tier has a billing type: monthly, one_time (a single purchase) or per_use (per order, per kg, per session).
- avg_revenue_per_customer: what ONE paying customer pays in a typical month across tiers
  (a one_time buyer who buys once a month = that price; per_use = price x uses per month).
- Discounts, free trials and referral rewards lower revenue: never put them in burn or the marketing budget.
- starting_capital: the founder's own money (see HARD RULES); never more than they said they can put in.
- Price for the target customer's real willingness to pay in this market; say which assumption it rests on.
- Day 30/60/90 targets must be honest. 5 paying users at Day 30 beats a fantasy number."""


def run(state: dict) -> EconomicsSlice:
    profile = state["profile"]
    caps = ""
    if profile["burn_cap"]:
        caps = f"Caps: monthly_burn <= {profile['burn_cap']}, external_funding = 0."
    prompt = f"""{build_context_block(state)}

STRATEGY (fixed input):
{slice_json(state, "strategist")}

BUILD, incl. tool costs you must carry into the burn (fixed input):
{slice_json(state, "builder")}

{PERSONA}
All money in {profile['currency']} as plain numbers. {caps}
{revision_block(state, "economics")}"""
    return call_llm_json(prompt, EconomicsSlice, role="economics", system=ANTI_FLUFF_RULES, max_tokens=4000)
