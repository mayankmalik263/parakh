from models import BuildSlice
from .context_block import ANTI_FLUFF_RULES, build_context_block, revision_block, slice_json, tool_knowledge
from .llm_router import call_llm_json

# Chesky-style: the one magic moment, scoped back to what ships in 30 days.
PERSONA = """You are the BUILDER. You own ONLY: stack, AI tools, first offer (mvp_features), tool costs, one-time setup cost, first 10 steps.
You do NOT set pricing, burn, revenue or marketing; other agents own those.
- tool_costs: every service the business runs on with exact plan name and monthly cost in the plan currency. Free tiers are 0. Amortise yearly costs per month.
- first_10_steps: concrete, ordered actions a founder can start today. Each step starts with a verb."""

# The business type is set by the Strategist; each type gets its own build rules.
BY_TYPE = {
    "software": """This is a SOFTWARE business.
- Default stack: Next.js (App Router) + Supabase + Tailwind, deployed on Vercel. React Native + Expo only if the idea truly needs a phone app. Deviate only with a reason tied to this idea.
- No custom ML training, no native iOS/Android for an MVP, no microservices. Use existing APIs.
- mvp_features: at most 3, and feature 1 is the core moment the user pays for.
- tool_costs: hosting, DB, auth, payments, email, domain, AI APIs.
- first_10_steps: include exact commands where relevant (e.g. "npx create-next-app@latest").""",
    "service": """This is a SERVICE business (agency, consulting, done-for-you). Do NOT plan an app or write code.
- stack: the tools used to deliver the work and run the business (e.g. design, scheduling, client comms, invoicing, a one-page portfolio site on a no-code builder).
- ai_tools: AI tools that cut delivery time per client.
- mvp_features: the first 1-3 sellable service packages, each with exact deliverables per month.
- tool_costs: every delivery and business tool, plus a portfolio site and domain.
- mvp_build_cost: one-time setup (portfolio site, domain, templates, a paid pilot's costs).
- first_10_steps: pick the niche, build 2-3 case studies via discounted pilots, write the proposal and contract, set up invoicing, line up 1-2 freelancers for overflow.""",
    "physical": """This is a PHYSICAL product business.
- stack: storefront, payments, shipping/fulfilment and inventory tools. No custom app.
- mvp_features: the first 1-3 SKUs or bundles, with unit specs.
- mvp_build_cost: samples, first small inventory batch, packaging, storefront setup.
- first_10_steps: source suppliers, order samples, validate with pre-orders before bulk inventory.""",
}


def run(state: dict) -> BuildSlice:
    profile = state["profile"]
    kind = state["slices"]["strategist"].get("business_type", "software")
    prompt = f"""{build_context_block(state)}

STRATEGY (fixed input):
{slice_json(state, "strategist")}

{tool_knowledge(profile) if kind == "software" else ""}

{PERSONA}
{BY_TYPE.get(kind, BY_TYPE["software"])}
All money in {profile['currency']}.
{revision_block(state, "builder")}"""
    return call_llm_json(prompt, BuildSlice, role="builder", system=ANTI_FLUFF_RULES)
