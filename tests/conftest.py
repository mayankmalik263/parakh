import copy
import os
import sys

import pytest

# Add the project root (one level up from tests/) to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

_SLICES = {
    "strategist": {
        "business_type": "software",
        "problem": "Clinic owners lose 20% of slots to no-shows every week.",
        "target_customer": "Solo dental clinic owners in US suburbs who book via phone.",
        "mission": "Cut dental no-shows with SMS reminders that patients answer.",
        "competitors": [{"name": "Weave", "differentiator": "We cost 10x less."},
                        {"name": "NexHealth", "differentiator": "No onboarding call needed."}],
        "scope_cuts": ["No EHR integration in v1: too slow to certify."],
    },
    "builder": {
        "stack": [{"name": "Next.js", "why": "Fast to ship."}, {"name": "Supabase", "why": "Auth + DB free."}],
        "ai_tools": [{"name": "Cursor", "why": "Writes the CRUD."}],
        "mvp_features": ["SMS reminder with reply-to-confirm"],
        "tool_costs": [{"tool": "Twilio", "plan": "Pay as you go", "monthly_cost": 40},
                       {"tool": "Cursor", "plan": "Pro", "monthly_cost": 20}],
        "mvp_build_cost": 100,
        "first_10_steps": ["Run npx create-next-app@latest", "Create Supabase project", "Buy Twilio number",
                           "Build booking import", "Ship reminder cron"],
    },
    "economics": {
        "pricing": [{"name": "Pro", "monthly_price": 49, "features": ["Unlimited reminders"]}],
        "avg_revenue_per_customer": 49,
        "delivery_cost_per_customer": 9,
        "burn_line_items": [{"item": "Twilio", "monthly_cost": 40}, {"item": "Cursor", "monthly_cost": 20},
                            {"item": "Marketing", "monthly_cost": 100}],
        "monthly_burn": 160,
        "marketing_budget": 100,
        "starting_capital": 1600,
        "external_funding": 0,
        "runway_months": 10,
        "break_even_customers": 4,
        "revenue_targets": [{"day": 30, "paying_customers": 3, "mrr": 147, "notes": ""},
                            {"day": 60, "paying_customers": 6, "mrr": 294, "notes": ""},
                            {"day": 90, "paying_customers": 10, "mrr": 490, "notes": ""}],
        "key_assumptions": ["Clinics pay $49 if it saves 2 slots/month."],
    },
    "growth": {
        "channels": [{"name": "Cold calls", "tactic": "Call 30 clinics/day from Google Maps", "monthly_spend": 100,
                      "new_customers_per_month": 4, "cac": 25}],
        "first_10_customers": ["List 300 clinics", "Call 30/day", "Offer 30-day free pilot"],
        "cold_message": "Hi Dr. X,\nYou lose ~6 slots a week to no-shows.\nCan I cut that in half free for 30 days?",
        "objections": [{"objection": "We already call patients", "response": "Your receptionist's time costs more."},
                       {"objection": "Patients ignore SMS", "response": "Reply-to-confirm gets 70% response."}],
    },
}

PROFILE = {"market": "US", "is_india": False, "currency": "USD", "symbol": "$",
           "funding": "bootstrapped", "burn_cap": 500, "mvp_cap": 500}


@pytest.fixture
def slices():
    return copy.deepcopy(_SLICES)


@pytest.fixture
def profile():
    return dict(PROFILE)
