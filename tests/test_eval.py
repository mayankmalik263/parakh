"""The eval scorer: these checks are what the before/after numbers rest on."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "eval"))
from metrics import hidden_costs, invented_stats, same_tool  # noqa: E402


def test_tool_names_match_across_plan_words_but_not_across_products():
    assert same_tool("CapCut Pro (Annual)", "CapCut")
    assert same_tool("Razorpay", "Razorpay Payment Links")
    assert same_tool("WhatsApp Business", "WhatsApp Business app")
    assert not same_tool("Google Drive", "Google Forms")


def test_recommended_tool_without_a_cost_line_is_a_hidden_cost():
    slices = {"builder": {
        "stack": [{"name": "CapCut Pro", "why": "edits"}, {"name": "Google Drive", "why": "files"}],
        "ai_tools": [{"name": "ElevenLabs", "why": "voice"}],
        "tool_costs": [{"tool": "CapCut", "plan": "Pro", "monthly_cost": 333}, {"tool": "Google Drive", "plan": "Free", "monthly_cost": 0}],
    }}
    assert hidden_costs(slices) == ["ElevenLabs"]


def test_unsourced_stats_are_flagged_but_founder_numbers_are_not():
    slices = {"strategist": {"problem": "Owners see 500+ views on rival reels and lose 20% of footfall.",
                             "target_customer": "Cafes within 3 km of campus."},
              "builder": {"ai_tools": [{"name": "Opus Clip", "why": "cuts trimming time by 50%, saving 30 minutes"}]}}
    claims = [h["claim"] for h in invented_stats(slices, "cafes within 3 km, budget 20% of savings")]
    assert claims == ["500+ views", "50%", "saving 30 minutes"]
