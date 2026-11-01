from typing import TypedDict


class StartupState(TypedDict):
    startup_idea: str
    target_audience: str
    market: str
    revenue_model: str
    constraints: str

    # Parsed once at start: market, currency, funding mode, caps
    profile: dict
    lessons: list

    # Agent outputs: {"strategist": {...}, "builder": {...}, "economics": {...}, "growth": {...}}
    slices: dict
    # JSON of the upstream inputs each agent last ran on; unchanged inputs + no issues = skip the call
    input_keys: dict
    # time.monotonic() at the start of the run, for the second-revision time budget
    started_at: float
    # Open issues for the next revision pass: [{owner, problem, fix, source}]
    issues: list
    # Every issue ever raised (math + critic), for the report
    conflicts: list
    critic: dict
    revision: int
    max_revisions: int
    # Earliest agent to re-run after the Critic ("" = go to report)
    revise_from: str
    messages: list

    final_report: str
    business_plan: dict
    math_warnings: list

    # SSE event streaming
    job_id: str
    user_id: str


def create_state(
    idea: str,
    target_audience: str = "",
    market: str = "",
    revenue_model: str = "",
    constraints: str = "",
    job_id: str = "",
    user_id: str = "",
) -> StartupState:
    return {
        "startup_idea": idea,
        "target_audience": target_audience,
        "market": market,
        "revenue_model": revenue_model,
        "constraints": constraints,
        "profile": {},
        "lessons": [],
        "slices": {},
        "input_keys": {},
        "started_at": 0.0,
        "issues": [],
        "conflicts": [],
        "critic": {},
        "revision": 0,
        "max_revisions": 2,
        "revise_from": "",
        "messages": [],
        "final_report": "",
        "business_plan": {},
        "math_warnings": [],
        "job_id": job_id,
        "user_id": user_id,
    }
