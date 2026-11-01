"""Builds the landing page's example plan with Parakh's own code, so its numbers pass the same checks.

The plan is written by hand (no model call). Run from the repo root:
    python scripts/make_example_plan.py
It fails if autofix_math or check_plan would change or flag anything.
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from agents.context_block import build_profile
from evaluation_engine import autofix_math, check_plan
from models import BuildSlice, EconomicsSlice, GrowthSlice, StrategySlice
from report_generator import build_display_plan, render_report

idea = "Notes and past papers for juniors at my college, sold before exams"
state = {"startup_idea": idea, "market": "India", "constraints": "Funding: Bootstrapped. Founder: Student.", "target_audience": ""}
profile = build_profile(state)

slices = {
 "strategist": StrategySlice.model_validate({
  "business_type": "software",
  "problem": "First- and second-years skip classes, then panic the week before mid-sems with no clean notes for subjects like DBMS and OS.",
  "target_customer": "First- and second-year B.Tech students at one campus who study in the last 7 days before an exam and already pay for printouts.",
  "mission": "Sell exam-week note bundles, made from toppers' notes and past papers, to juniors on one campus.",
  "competitors": [
   {"name": "Free PDFs in class WhatsApp groups", "differentiator": "Ours are sorted by unit, checked by a topper and match this semester's syllabus."},
   {"name": "Photocopy shops near campus", "differentiator": "No queue the night before the exam, and the notes are searchable."}],
  "scope_cuts": ["No app in v1: a Drive link after payment does the job.", "No subjects beyond 2nd year until the first 40 bundles sell."]}).model_dump(),
 "builder": BuildSlice.model_validate({
  "stack": [{"name": "Google Drive", "why": "Share each bundle as a view-only folder after payment."},
            {"name": "Notion (free page)", "why": "One public page listing subjects and prices."}],
  "ai_tools": [{"name": "Claude", "why": "Turns scanned notes into a clean unit-wise index."}],
  "mvp_features": ["Unit-wise note bundle per subject, with the last 3 years of papers", "Pay by UPI through a payment link, get the Drive link on WhatsApp"],
  "tool_costs": [{"tool": "Google Drive", "plan": "Free (15 GB)", "monthly_cost": 0},
                 {"tool": "Notion", "plan": "Free", "monthly_cost": 0},
                 {"tool": "Razorpay Payment Links", "plan": "Per transaction", "monthly_cost": 0}],
  "mvp_build_cost": 1200,
  "first_10_steps": ["Ask 3 toppers for their DBMS and OS notes in exchange for ₹20 per bundle sold",
                     "Scan and sort the notes by unit", "Collect the last 3 years of papers for both subjects",
                     "Make one Notion page with subjects and prices", "Create a ₹149 Razorpay Payment Link",
                     "Post one free sample page in 6 first-year WhatsApp groups"]}).model_dump(),
 "economics": EconomicsSlice.model_validate({
  "pricing": [{"name": "One subject", "monthly_price": 149, "features": ["Unit-wise notes", "3 years of papers"]},
              {"name": "Two subjects", "monthly_price": 249, "features": ["Both bundles", "Most-asked questions list"]}],
  "avg_revenue_per_customer": 149, "delivery_cost_per_customer": 25,
  "burn_line_items": [{"item": "Scanning and printing", "monthly_cost": 500},
                      {"item": "Posters at the canteen and hostel", "monthly_cost": 1000},
                      {"item": "Instagram story boosts (marketing budget)", "monthly_cost": 1000},
                      {"item": "Google Drive", "monthly_cost": 0}, {"item": "Notion", "monthly_cost": 0},
                      {"item": "Razorpay Payment Links", "monthly_cost": 0}],
  "monthly_burn": 2500, "marketing_budget": 1000, "starting_capital": 8000, "external_funding": 0,
  "runway_months": 3.2, "break_even_customers": 21,
  "revenue_targets": [{"day": 30, "paying_customers": 10, "mrr": 1490, "notes": "Mid-sem week"},
                      {"day": 60, "paying_customers": 25, "mrr": 3725, "notes": "Second subject added"},
                      {"day": 90, "paying_customers": 40, "mrr": 5960, "notes": "End-sem season"}],
  "key_assumptions": ["A first-year pays ₹149 for one subject the week before an exam.", "Each topper gets ₹20 per bundle sold."]}).model_dump(),
 "growth": GrowthSlice.model_validate({
  "channels": [{"name": "Class WhatsApp groups", "tactic": "Post one free sample page in 6 first-year groups the week before mid-sems", "monthly_spend": 0, "new_customers_per_month": 8, "cac": 0},
               {"name": "Instagram story boosts", "tactic": "Boost one story a week to students within 2 km of campus", "monthly_spend": 1000, "new_customers_per_month": 3, "cac": 333}],
  "first_10_customers": ["Message 20 juniors from your own club or hostel", "Give the first 5 buyers a second subject free for a review", "Ask each buyer to forward the sample page to one class group"],
  "cold_message": "Hey, mid-sems start next week. I made DBMS notes sorted by unit with the last 3 years of papers. Want the free sample page?",
  "objections": [{"objection": "The same PDFs are free in our group", "response": "Ours are sorted by unit and checked by a topper. The sample page is free, so compare first."},
                 {"objection": "₹149 is a lot for notes", "response": "It's less than a photocopy run of the same pages, and you get it tonight."}]}).model_dump(),
}
fixed = autofix_math(slices)
issues = check_plan(slices, profile)
assert not fixed and not issues, (fixed, issues)
critic = {"verdict": "Workable for one campus if about 21 juniors buy each month. The price fits an exam-week panic buy, and the costs are low enough to survive a slow first month.",
          "biggest_risk": "A buyer posts the bundle in a class group and nobody needs to pay after that.", "adherence_score": 0.9}
st = {"startup_idea": idea, "profile": profile, "slices": slices, "conflicts": [], "critic": critic, "math_warnings": [], "revision": 0, "messages": [],
      "market": "India", "target_audience": "", "revenue_model": "", "constraints": state["constraints"]}
plan = build_display_plan(st).model_dump()
report = render_report(st)
out = str(ROOT / "parakh-frontend" / "src" / "lib") + "/"
json.dump(plan, open(out + "example-plan.json", "w"), ensure_ascii=False, indent=1)
ts = f"""import type {{ BusinessPlan }} from '@/types/simulation';
import plan from './example-plan.json';

// An EXAMPLE plan, written by hand to show what Parakh gives you. It went through Parakh's own
// report code and passes the same math checks a real run does (see scripts/make_example_plan.py). It is not output from a model run, and the landing page says so.
export const EXAMPLE_IDEA = {json.dumps(idea, ensure_ascii=False)};
export const EXAMPLE_CONTEXT = 'Example · India · student · ₹8,000 to start';
export const EXAMPLE_PLAN = plan as BusinessPlan;
export const EXAMPLE_REPORT = {json.dumps(report, ensure_ascii=False)};
"""
open(out + "examplePlan.ts", "w").write(ts)
print("ok", profile, list(plan.keys()))
