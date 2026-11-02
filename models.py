import re
from typing import Annotated, List, Literal, Optional

from pydantic import BaseModel, BeforeValidator, Field, model_validator


def _to_number(value):
    """Accepts 1200, "1,200", "₹1,200/mo", "$1.2k" from the LLM and returns a float."""
    if isinstance(value, (int, float)) or value is None:
        return value
    text = str(value).replace(",", "")
    match = re.search(r"(-?\d+(?:\.\d+)?)\s*([kKmM]\b)?", text)
    if not match:
        return value  # let pydantic raise a clear error
    number = float(match.group(1))
    suffix = (match.group(2) or "").lower()
    return number * {"k": 1_000, "m": 1_000_000}.get(suffix, 1)



def _cap(n: int):
    """Keep the first n items. A model that writes 4 price tiers when 3 are allowed gets trimmed, not re-asked."""
    return BeforeValidator(lambda v: v[:n] if isinstance(v, list) else v)

Money = Annotated[float, BeforeValidator(_to_number), Field(ge=0)]
Count = Annotated[int, BeforeValidator(lambda v: round(_to_number(v)) if v is not None else v), Field(ge=0)]


# ── Agent slices: each agent owns exactly one of these ─────────────────────

class Competitor(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    differentiator: str = Field(min_length=5, max_length=500, description="Why we win against them, one line")


BusinessType = Literal["software", "service", "physical"]


class StrategySlice(BaseModel):
    business_type: BusinessType = Field(description="software (app/SaaS/API), service (agency, consulting, done-for-you), physical (products shipped)")
    problem: str = Field(min_length=10, description="The specific pain and the exact moment the user feels it")
    target_customer: str = Field(min_length=10, description="One sentence: who, where, what behaviour makes them a buyer")
    mission: str = Field(min_length=10, description="One sentence: what we do, for whom, why we win")
    competitors: Annotated[List[Competitor], _cap(3)] = Field(min_length=2, max_length=3)
    scope_cuts: Annotated[List[str], _cap(3)] = Field(min_length=1, max_length=3, description="Things we are deliberately NOT building, with reason")


class StackItem(BaseModel):
    name: str
    why: str = Field(description="Why this choice for THIS idea, one line")


class ToolCost(BaseModel):
    tool: str
    plan: str = Field(description="Exact plan/tier name, e.g. 'Supabase Free'")
    monthly_cost: Money = Field(description="Monthly cost in the plan currency; 0 if free")


class BuildSlice(BaseModel):
    stack: Annotated[List[StackItem], _cap(6)] = Field(min_length=2, max_length=6)
    ai_tools: Annotated[List[StackItem], _cap(4)] = Field(min_length=1, max_length=4)
    mvp_features: Annotated[List[str], _cap(3)] = Field(min_length=1, max_length=3)
    tool_costs: List[ToolCost] = Field(min_length=1, description="Every paid or free service the MVP runs on")
    mvp_build_cost: Money = Field(description="One-time cost to ship the MVP, in plan currency")
    first_10_steps: Annotated[List[str], _cap(10)] = Field(min_length=5, max_length=10)


class PricingTier(BaseModel):
    name: str = Field(min_length=2, max_length=50)
    # Kept as monthly_price so saved plans still load; with billing it is the price of one billing unit.
    monthly_price: Money = Field(description="Price in plan currency: per month, per purchase or per use (see billing); 0 for a free tier")
    billing: Literal["monthly", "one_time", "per_use"] = Field(default="monthly", description="monthly subscription, one_time purchase, or per_use (per order, per kg, per session)")
    features: List[str] = Field(min_length=1)


class LineItem(BaseModel):
    item: str
    monthly_cost: Money


class RevenueTarget(BaseModel):
    day: Count = Field(gt=0)
    paying_customers: Count
    mrr: Money
    notes: str = ""


class EconomicsSlice(BaseModel):
    pricing: Annotated[List[PricingTier], _cap(3)] = Field(min_length=1, max_length=3)
    avg_revenue_per_customer: Money = Field(description="Blended monthly revenue per PAYING customer")
    delivery_cost_per_customer: Money = Field(description="Monthly cost to serve ONE paying customer: freelancers, per-client tools, API usage, goods")
    burn_line_items: List[LineItem] = Field(min_length=1, description="Must include every Builder tool cost and the marketing budget")
    monthly_burn: Money = Field(description="Exactly the sum of burn_line_items")
    marketing_budget: Money = Field(description="Monthly cap Growth may spend; must also appear as a burn line item")
    starting_capital: Money = Field(description="Cash available at start (founder savings or raised money)")
    external_funding: Money = Field(description="Outside money raised; 0 if bootstrapped")
    runway_months: Annotated[float, BeforeValidator(_to_number), Field(ge=0)] = Field(description="starting_capital / monthly_burn")
    break_even_customers: Count = Field(description="ceil(monthly_burn / (avg_revenue_per_customer - delivery_cost_per_customer))")
    revenue_targets: Annotated[List[RevenueTarget], _cap(3)] = Field(min_length=3, max_length=3, description="Day 30, 60 and 90")
    key_assumptions: Annotated[List[str], _cap(4)] = Field(min_length=1, max_length=4)


class Channel(BaseModel):
    name: str
    tactic: str = Field(description="Exact platform, action, volume, e.g. 'DM 40 clinic owners/day on LinkedIn'")
    monthly_spend: Money
    new_customers_per_month: Count
    cac: Optional[Money] = Field(default=None, description="monthly_spend / new_customers_per_month")

    @model_validator(mode="after")
    def _fill_cac(self):
        # Code can work this out; a missing cac shouldn't cost a retry.
        if self.cac is None:
            self.cac = round(self.monthly_spend / self.new_customers_per_month, 2) if self.new_customers_per_month else 0.0
        return self


class Objection(BaseModel):
    objection: str
    response: str


class GrowthSlice(BaseModel):
    channels: Annotated[List[Channel], _cap(2)] = Field(min_length=1, max_length=2)
    first_10_customers: Annotated[List[str], _cap(6)] = Field(min_length=3, max_length=6, description="Step-by-step founder hustle to land the first 10 paying customers")
    cold_message: str = Field(min_length=20, description="A 3-line cold DM/email the founder can send today")
    objections: Annotated[List[Objection], _cap(2)] = Field(min_length=2, max_length=2)


Owner = Literal["strategist", "builder", "economics", "growth"]


class CriticIssue(BaseModel):
    owner: Owner
    severity: Literal["blocking", "minor"] = Field(default="blocking", description="blocking: the founder would make a bad decision or get stuck, so the owner rewrites; minor: a note kept in the plan, no rewrite")
    problem: str = Field(description="One or two sentences")
    fix: str = Field(description="Exactly what the owner must change, one sentence")


class CriticResult(BaseModel):
    verdict: str = Field(min_length=20, description="3 sentence honest verdict on viability")
    biggest_risk: str = Field(min_length=20, description="The single most likely reason THIS plan fails, specific to this idea. Required even if issues is empty.")
    adherence_score: Annotated[float, Field(ge=0, le=1)] = Field(description="How well the plan honours market + funding constraints, 0-1")
    issues: List[CriticIssue] = Field(default_factory=list, description="At most 4; empty if the plan is sound")


# ── Display plan: the shape the frontend renders (built in Python from slices) ──

class DisplayPricingTier(BaseModel):
    name: str
    price: str
    features: List[str]


class FinancialSnapshot(BaseModel):
    monthly_burn: str
    burn_breakdown: str = ""
    funding_needed: str
    runway: str
    break_even_target: str


class DisplayRevenueTarget(BaseModel):
    day: int
    mrr: str
    notes: str = ""


class Conflict(BaseModel):
    title: str
    description: str


class DisplayTool(BaseModel):
    name: str
    plan: str
    monthly_cost: str
    verified: bool = False
    note: str = ""


class StartupBusinessPlan(BaseModel):
    startup_idea: str
    mission: str
    problem: str
    target_customer: str
    business_model: List[DisplayPricingTier]
    financial_snapshot: FinancialSnapshot
    go_to_market: List[str]
    product_mvp: List[str]
    revenue_targets: List[DisplayRevenueTarget]
    competition: List[Competitor] = Field(default_factory=list)
    tools: List[DisplayTool] = Field(default_factory=list)
    key_conflicts: List[Conflict] = Field(default_factory=list)
    final_verdict: str


# ── Deck critique: numbers read from a pitch deck or a pasted numbers sheet ──

def _to_optional_number(value):
    """Like _to_number, but blanks and "n/a" mean the deck didn't say: None."""
    if value is None or (isinstance(value, str) and value.strip().lower() in ("", "n/a", "na", "-", "none", "null", "unknown")):
        return None
    return _to_number(value)


OptMoney = Annotated[Annotated[float, Field(ge=0)] | None, BeforeValidator(_to_optional_number)]
OptCount = Annotated[Annotated[int, Field(ge=0)] | None,
                     BeforeValidator(lambda v: (lambda n: round(n) if isinstance(n, (int, float)) else n)(_to_optional_number(v)))]
OptFloat = Annotated[Annotated[float, Field(ge=0)] | None, BeforeValidator(_to_optional_number)]


class ClaimedLineItem(BaseModel):
    item: str
    monthly_cost: OptMoney = None


class ClaimedTarget(BaseModel):
    label: str = Field(description="When, as written, e.g. 'Month 6', 'Dec 2026', 'Year 1'")
    paying_customers: OptCount = None
    mrr: OptMoney = None


class ClaimedChannel(BaseModel):
    name: str
    monthly_spend: OptMoney = None
    new_customers_per_month: OptCount = None
    cac: OptMoney = None


class DeckClaims(BaseModel):
    """Only what the deck states. Every number the deck doesn't give stays null: never guess or compute."""
    startup_name: str = ""
    one_liner: str = Field(default="", description="What the business does, in the deck's words, one sentence")
    currency: Literal["INR", "USD"] = "INR"
    price_per_customer_monthly: OptMoney = Field(default=None, description="Average monthly revenue per PAYING customer")
    delivery_cost_per_customer: OptMoney = Field(default=None, description="Monthly cost to serve one paying customer")
    monthly_burn: OptMoney = Field(default=None, description="Total monthly spend as the deck states it")
    burn_line_items: List[ClaimedLineItem] = Field(default_factory=list)
    cash_in_bank: OptMoney = Field(default=None, description="Money available now (savings, raised, grants)")
    funding_ask: OptMoney = Field(default=None, description="Amount the deck asks investors for")
    runway_months: OptFloat = None
    break_even_customers: OptCount = None
    current_paying_customers: OptCount = None
    current_mrr: OptMoney = None
    revenue_targets: List[ClaimedTarget] = Field(default_factory=list)
    channels: List[ClaimedChannel] = Field(default_factory=list)
    market_size_claims: List[str] = Field(default_factory=list, description="TAM/SAM/SOM and similar, quoted")
    other_claims: List[str] = Field(default_factory=list, description="Other factual claims worth checking, quoted")
    unreadable: List[str] = Field(default_factory=list, description="Numbers that were present but could not be read with confidence")


class DeckRedFlag(BaseModel):
    claim: str = Field(description="The claim as the deck makes it")
    problem: str = Field(description="Why a judge or investor won't believe it, one or two sentences")
    fix: str = Field(description="What to change or prove instead, one sentence")


class DeckVerdict(BaseModel):
    verdict: str = Field(min_length=20, description="Three honest sentences: would this deck convince a careful judge?")
    biggest_risk: str = Field(min_length=10, description="The single most likely reason this business fails")
    red_flags: Annotated[List[DeckRedFlag], _cap(5)] = Field(default_factory=list, max_length=5)
    missing: Annotated[List[str], _cap(5)] = Field(default_factory=list, max_length=5, description="Numbers a judge will ask for that the deck doesn't give")
    questions_to_expect: Annotated[List[str], _cap(3)] = Field(default_factory=list, max_length=3)
