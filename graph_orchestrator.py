"""
MASS agent graph.

  Strategist -> Builder -> Economics -> Growth -> Critic --(issues, 2 revisions max)--> earliest agent at fault
                                                    |                                   (re-runs it and downstream agents whose inputs changed)
                                                    +--(sound, or revisions used up)--> Report

Each agent owns one JSON slice of the plan. Python corrects the arithmetic it can, checks the rest
before the Critic looks at it, and every issue is addressed to the one agent that owns the broken field.
"""
import json
import time

from langgraph.graph import END, StateGraph

import event_bus
from agents import builder, critic, economics, growth, strategist
from agents.context_block import build_profile, get_lessons_from_db
from evaluation_engine import autofix_math, check_plan
from report_generator import build_display_plan, render_report
from save_report import save_state
from state import StartupState, create_state

AGENT_CHAIN = ["strategist", "builder", "economics", "growth"]
LABELS = {"strategist": "Strategist", "builder": "Builder", "economics": "Economics", "growth": "Growth"}
# A second revision round starts only if the run is still under this. Measured on the Groq free
# tier: one full revision round costs ~70-90s, and a single-round run took ~130-170s.
SECOND_ROUND_BUDGET_S = 100

RUNNERS = {"strategist": strategist.run, "builder": builder.run, "economics": economics.run, "growth": growth.run}


def _summary(owner: str, data: dict, profile: dict) -> str:
    s = profile["symbol"]
    if owner == "strategist":
        return data["mission"]
    if owner == "builder":
        return "Stack: " + ", ".join(i["name"] for i in data["stack"]) + f". MVP: {data['mvp_features'][0]}"
    if owner == "economics":
        price = data["avg_revenue_per_customer"]
        return (f"{s}{price:,.0f}/customer/mo, burn {s}{data['monthly_burn']:,.0f}/mo, "
                f"break-even at {data['break_even_customers']} customers, runway {data['runway_months']:.1f} mo")
    return "Channels: " + "; ".join(c["name"] for c in data["channels"])


def _input_key(owner: str, state: StartupState) -> str:
    """JSON of everything upstream this agent reads. Same key = same inputs as last run."""
    sl = state["slices"]
    upstream = {
        "strategist": None,
        "builder": lambda: sl["strategist"],
        "economics": lambda: [sl["strategist"], sl["builder"]],
        "growth": lambda: [sl["strategist"], growth.numbers(sl["economics"])],
    }[owner]
    return json.dumps(upstream() if upstream else None, sort_keys=True, ensure_ascii=False)


def _agent_node(owner: str):
    label = LABELS[owner]

    def node(state: StartupState) -> StartupState:
        job_id = state.get("job_id", "")
        round_num = state["revision"] + 1
        key = _input_key(owner, state)

        # On a revision pass, an agent with no issues whose inputs didn't change would only repeat itself.
        unchanged = owner in state["slices"] and state["input_keys"].get(owner) == key
        if unchanged and not any(i["owner"] == owner for i in state["issues"]):
            print(f"[{label}] inputs unchanged, skipping (round {round_num})")
            event_bus.publish(job_id, {"type": "agent_done", "agent": label, "round": round_num,
                                       "summary": "No change needed: its inputs did not change."})
            return state
        print(f"[{label}] thinking... (round {round_num})")
        event_bus.publish(job_id, {"type": "agent_start", "agent": label, "round": round_num})

        data = RUNNERS[owner](state).model_dump()
        state["slices"][owner] = data
        state["input_keys"][owner] = key
        state["messages"].append({"agent": label, "round": state["revision"], "message": json.dumps(data, ensure_ascii=False)})

        event_bus.publish(job_id, {
            "type": "agent_done", "agent": label, "round": round_num,
            "summary": _summary(owner, data, state["profile"]),
        })
        return state

    return node


def critic_node(state: StartupState) -> StartupState:
    job_id = state.get("job_id", "")
    round_num = state["revision"] + 1
    print(f"[Critic] reviewing... (round {round_num})")
    event_bus.publish(job_id, {"type": "agent_start", "agent": "Critic", "round": round_num})

    fixed = autofix_math(state["slices"])
    if fixed:
        print(f"[Critic] code corrected {len(fixed)} number(s): {'; '.join(fixed)}")
    math = check_plan(state["slices"], state["profile"])
    try:
        result = critic.run(state, math)
        critic_issues = [{**i.model_dump(), "source": "critic"} for i in result.issues[:4]]
        state["critic"] = result.model_dump(exclude={"issues"})
    except Exception as e:
        # A failed review (rate limit, bad JSON) must not sink a finished plan: keep the last verdict and stop revising.
        print(f"[Critic] review failed, finishing with the plan as is: {e}")
        critic_issues, state["critic"] = [], state["critic"] or {
            "verdict": "The Critic could not complete its review on this run. The arithmetic checks still applied.",
            "biggest_risk": "", "adherence_score": 0.5}
    issues = math + critic_issues

    state["issues"] = issues
    state["conflicts"].extend({**i, "round": round_num} for i in issues)
    state["math_warnings"] = [f["problem"] for f in math]

    # Round 2 of revisions only if round 1 finished fast enough: on the free tier every round
    # costs about a minute of rate-limit budget, and the plan must not take longer than before.
    elapsed = time.monotonic() - state["started_at"]
    in_budget = state["revision"] == 0 or elapsed < SECOND_ROUND_BUDGET_S
    will_revise = bool(issues) and state["revision"] < state["max_revisions"] and in_budget
    print(f"[Critic] {elapsed:.0f}s elapsed, {len(issues)} issue(s), revise: {will_revise}")
    owners = {i["owner"] for i in issues}
    state["revise_from"] = next((o for o in AGENT_CHAIN if o in owners), "") if will_revise else ""

    event_bus.publish(job_id, {
        "type": "supervisor_result",
        "agent": "Critic",
        "round": round_num,
        "agreed": not issues,
        "reason": state["critic"]["verdict"],
        "conflicts": [{"title": f"{LABELS[i['owner']]} ({i['source']})", "description": f"{i['problem']} Fix: {i['fix']}"} for i in issues],
        "decisions": [],
        "forced": bool(issues) and not will_revise,
    })

    if will_revise:
        state["revision"] += 1
        rerun = AGENT_CHAIN[AGENT_CHAIN.index(state["revise_from"]):]
        print(f"[Critic] {len(issues)} issue(s). Revising: {', '.join(rerun)}")
        event_bus.publish(job_id, {
            "type": "debate_loop",
            "round": state["revision"] + 1,
            "agents": [LABELS[o] for o in rerun],
            "reason": f"{len(issues)} issue(s) found. Revising {', '.join(LABELS[o] for o in rerun)}.",
        })
    return state


def report_node(state: StartupState) -> StartupState:
    job_id = state.get("job_id", "")
    print("[Report] rendering build plan...")
    event_bus.publish(job_id, {"type": "agent_start", "agent": "Report", "round": state["revision"] + 1})

    plan = build_display_plan(state)
    state["business_plan"] = plan.model_dump()
    state["final_report"] = render_report(state)
    save_state(state, state["final_report"], plan)

    event_bus.publish(job_id, {
        "type": "agent_done", "agent": "Report", "round": state["revision"] + 1,
        "summary": f"Build plan ready. {len(state['math_warnings'])} unresolved math warning(s).",
    })
    return state


def route_after_critic(state: StartupState) -> str:
    return state["revise_from"] or "report"


def build_graph():
    graph = StateGraph(StartupState)
    for owner in AGENT_CHAIN:
        graph.add_node(owner, _agent_node(owner))
    graph.add_node("critic", critic_node)
    graph.add_node("report", report_node)

    graph.set_entry_point("strategist")
    for upstream, downstream in zip(AGENT_CHAIN, AGENT_CHAIN[1:] + ["critic"]):
        graph.add_edge(upstream, downstream)
    graph.add_conditional_edges("critic", route_after_critic, {o: o for o in AGENT_CHAIN + ["report"]})
    graph.add_edge("report", END)
    return graph.compile()


def run(idea: str, context: dict | None = None, job_id: str = "", user_id: str = "") -> StartupState:
    context = context or {}
    state = create_state(
        idea=idea,
        target_audience=context.get("target_audience", ""),
        market=context.get("market", ""),
        revenue_model=context.get("revenue_model", ""),
        constraints=context.get("constraints", ""),
        job_id=job_id,
        user_id=user_id,
    )
    state["started_at"] = time.monotonic()
    state["profile"] = build_profile(state)
    state["lessons"] = get_lessons_from_db(state["profile"])
    print(f"[MASS] profile: {state['profile']}")

    final_state = build_graph().invoke(state)
    event_bus.publish(job_id, {"type": "job_done"})

    print("\n" + "=" * 50 + "\nFINAL REPORT\n" + "=" * 50)
    print(final_state["final_report"])
    print(f"\n[SNAPSHOT] agent calls: {len(final_state['messages'])}, revisions: {final_state['revision']}, "
          f"issues raised: {len(final_state['conflicts'])}, unresolved math: {len(final_state['math_warnings'])}")
    return final_state
