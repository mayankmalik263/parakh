import asyncio
import json
import os
import sys
from dotenv import load_dotenv

load_dotenv(override=True)

# Windows consoles default to cp1252: a "₹" in a log line must not crash a simulation.
for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(errors="replace")
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from auth import get_current_user
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from job_store import create_job, update_job, get_job, JobStatus
from graph_orchestrator import run
import event_bus

from supabase_client import get_supabase
from agents.llm_router import call_llm, call_llm_json, use_bharatcode_key

app = FastAPI(title="MASS API", description="Multi-Agent Startup Simulator")

# CORS — reads allowed origins from ALLOWED_ORIGINS env var
# Browsers send origins without a trailing slash, so "https://site.app/" would never match.
allowed_origins = [o.strip().rstrip("/") for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]

@app.middleware("http")
async def bharatcode_key_from_header(request, call_next):
    # Optional visitor-supplied BharatCode key. The endpoint and its background tasks run in a copy of
    # this context, so every LLM call for the request (including a whole simulation) uses it.
    with use_bharatcode_key(request.headers.get("x-bharatcode-key")):
        return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SimulateRequest(BaseModel):
    idea: str
    target_audience: str = ""
    market: str = ""
    revenue_model: str = ""
    constraints: str = ""
    tier: str = "free"


class ClarifyRequest(BaseModel):
    idea: str
    tier: str = "free"  # ignored; kept so older clients don't 422


class ClarifyQuestion(BaseModel):
    question: str
    options: list[str] = Field(min_length=2, max_length=4)


class ClarifyResponse(BaseModel):
    questions: list[ClarifyQuestion] = Field(min_length=3, max_length=10)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    tier: str = "free"
    messages: list[ChatMessage]


class EvaluateRequest(BaseModel):
    idea: str = ""
    target_audience: str = ""
    market: str = ""
    revenue_model: str = ""
    constraints: str = ""
    runs: int = 2
    simulation_id: str | None = None
    stress_constraints: list[str] | None = None



class FeedbackRequest(BaseModel):
    section: str
    rating_impact: int
    comment: str



def run_simulation(job_id: str, req: SimulateRequest, user_id: str):
    try:
        update_job(job_id, status=JobStatus.RUNNING)

        context = {
            "target_audience": req.target_audience,
            "market": req.market,
            "revenue_model": req.revenue_model,
            "constraints": req.constraints
        }

        final_state = run(req.idea, context, job_id=job_id, user_id=user_id)

        result = {
            "final_report": final_state.get("final_report", ""),
            "business_plan": final_state.get("business_plan", {}),
            "conflicts": final_state.get("conflicts", []),
            "debate_rounds": final_state.get("revision", 0) + 1,
            "messages_count": len(final_state.get("messages", []))
        }

        update_job(job_id, status=JobStatus.DONE, result=result)

    except Exception as e:
        event_bus.publish(job_id, {"type": "job_error", "error": str(e)})
        update_job(job_id, status=JobStatus.ERROR, error=str(e))
    finally:
        # Give SSE a moment to flush the last event, then clean up
        import time
        time.sleep(1)
        event_bus.cleanup(job_id)


@app.get("/")
def root():
    return {"status": "MASS API running", "docs": "/docs"}


@app.post("/simulate")
def simulate(req: SimulateRequest, background_tasks: BackgroundTasks, user_id: str = Depends(get_current_user)):
    job_id = create_job(user_id)
    background_tasks.add_task(run_simulation, job_id, req, user_id)
    return {"job_id": job_id, "status": "pending"}


@app.post("/clarify")
def clarify_idea(req: ClarifyRequest, user_id: str = Depends(get_current_user)):
    prompt = f"""You are an expert startup consultant. A founder gave you this raw startup idea:
"{req.idea}"

Before planning, clarify their target market, funding constraint, revenue model and customer.
Write exactly 10 multiple-choice questions, each with 3-4 distinct options.
The first question must be the target market (include "India (INR)" and "Global (USD)" options).
The second must be the funding constraint (include "Bootstrapped" and "Venture Backed" options)."""
    try:
        return call_llm_json(prompt, ClarifyResponse, role="clarify").model_dump()
    except Exception as e:
        print(f"Error in /clarify: {e}")
        # Fallback questions if LLM fails
        return {
            "questions": [
                {
                    "question": "What is your primary market?",
                    "options": ["Global", "India", "United States", "Europe"]
                },
                {
                    "question": "What is your funding situation?",
                    "options": ["Bootstrapped", "Venture Backed"]
                },
                {
                    "question": "What is the primary revenue model?",
                    "options": ["B2B SaaS", "B2C Subscription", "Marketplace / Commission", "One-time Purchase"]
                }
            ]
        }


@app.get("/simulate/{job_id}")
def get_simulation(job_id: str, user_id: str = Depends(get_current_user)):
    job = get_job(job_id)

    if job is None or job.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Job not found")

    response = {"job_id": job_id, "status": job["status"]}

    if job["status"] == JobStatus.DONE:
        response["result"] = job["result"]
    elif job["status"] == JobStatus.ERROR:
        response["error"] = job["error"]

    return response


@app.post("/simulate/{job_id}/chat")
def chat_with_council(job_id: str, req: ChatRequest, user_id: str = Depends(get_current_user)):
    # The saved simulation is the source of truth; a just-finished in-memory job covers a failed save.
    simulation_id, final_report = None, ""
    try:
        response = (get_supabase().table("simulations").select("id, final_report")
                    .eq("job_id", job_id).eq("user_id", user_id).execute())
        if response.data:
            simulation_id, final_report = response.data[0]["id"], response.data[0].get("final_report", "")
    except Exception as db_err:
        print(f"Failed to fetch simulation from database: {db_err}")
    if not final_report:
        job = get_job(job_id)
        if job and job.get("user_id") == user_id and job.get("status") == JobStatus.DONE:
            final_report = job.get("result", {}).get("final_report", "")

    if not final_report:
        raise HTTPException(status_code=404, detail="Simulation not found")

    system_prompt = f"""You are the MASS Startup Council. You just created this build plan for the founder:

{final_report}

The council: Strategist (problem, customer, competitors), Builder (stack, tools, steps),
Economics (pricing, burn, runway, targets), Growth (channels, first customers), Critic (review).
If the founder addresses one of them (e.g. "@Economics"), answer as that role. Otherwise answer as the Critic.
Keep answers concise, brutally honest, and specific to their constraints and the numbers in the plan."""

    if not req.messages or not req.messages[-1].content.strip():
        raise HTTPException(status_code=400, detail="Empty message")
    question = req.messages[-1].content[:4000]
    # The last few turns give follow-ups ("and in month 2?") their context without resending the whole chat.
    earlier = "\n".join(f"{'Founder' if m.role == 'user' else 'Council'}: {m.content[:1000]}" for m in req.messages[-7:-1])
    prompt = f"Conversation so far:\n{earlier}\n\nFounder: {question}" if earlier else question

    try:
        reply = call_llm(prompt, role="chat", system=system_prompt)
    except Exception as e:
        print(f"Error in chat: {e}")
        # Quota, busy and rejected-key messages are written for the user; anything else stays generic.
        msg = str(e)
        detail = msg if any(s in msg for s in ("quota", "BharatCode API key", "BharatCode is busy")) else "Failed to get chat response"
        raise HTTPException(status_code=500, detail=detail)

    if simulation_id:
        try:
            get_supabase().table("chat_messages").insert([
                {"simulation_id": simulation_id, "user_id": user_id, "role": "user", "content": question},
                {"simulation_id": simulation_id, "user_id": user_id, "role": "assistant", "content": reply},
            ]).execute()
        except Exception as db_err:
            print(f"Failed to save chat messages: {db_err}")
    return {"reply": reply}


@app.get("/simulations/{id}/chat")
def get_chat_history(id: str, user_id: str = Depends(get_current_user)):
    response = (get_supabase().table("chat_messages").select("role, content, created_at")
                .eq("simulation_id", id).eq("user_id", user_id).order("created_at").order("id").execute())
    return response.data


@app.get("/simulate/{job_id}/stream")
async def stream_simulation(job_id: str):
    """
    SSE endpoint — streams real-time agent activity events.

    Event format:  data: {"type": "agent_start", "agent": "CEO", ...}\n\n
    Terminal events: job_done, job_error (stream closes after these).
    """
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    loop = asyncio.get_event_loop()
    queue = event_bus.create_channel(job_id, loop)

    async def event_generator():
        try:
            while True:
                # Wait for next event (with timeout to detect dead jobs)
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=120)
                except asyncio.TimeoutError:
                    # Send keepalive comment
                    yield ": keepalive\n\n"
                    continue

                data = json.dumps(event)
                yield f"data: {data}\n\n"

                # Terminal events — close the stream
                if event.get("type") in ("job_done", "job_error"):
                    break
        except asyncio.CancelledError:
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

@app.get("/simulations")
def list_simulations(user_id: str = Depends(get_current_user)):
    try:
        supabase = get_supabase()
        response = supabase.table("simulations").select("id, job_id, idea, created_at").eq("user_id", user_id).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/simulations/{id}")
def get_simulation_by_id(id: str, user_id: str = Depends(get_current_user)):
    try:
        supabase = get_supabase()
        response = supabase.table("simulations").select("*").eq("id", id).eq("user_id", user_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Simulation not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/evaluate")
def evaluate(req: EvaluateRequest, background_tasks: BackgroundTasks, user_id: str = Depends(get_current_user)):
    from evaluation_engine import EvaluationEngine
    def run_evaluation_task(req_data: EvaluateRequest):
        try:
            engine = EvaluationEngine()
            idea = req_data.idea
            context = {
                "target_audience": req_data.target_audience,
                "market": req_data.market,
                "revenue_model": req_data.revenue_model,
                "constraints": req_data.constraints
            }
            
            if req_data.simulation_id:
                # Load original simulation
                supabase = get_supabase()
                sim_resp = supabase.table("simulations").select("*").eq("id", req_data.simulation_id).eq("user_id", user_id).execute()
                if sim_resp.data:
                    sim = sim_resp.data[0]
                    idea = sim.get("idea", "")
                    context = {
                        "target_audience": sim.get("target_audience", ""),
                        "market": sim.get("market", ""),
                        "revenue_model": sim.get("revenue_model", ""),
                        "constraints": sim.get("constraints", "")
                    }
            
            if req_data.stress_constraints:
                extra_rules = " | STRESS TEST CONSTRAINTS: " + " & ".join(req_data.stress_constraints)
                context["constraints"] = (context.get("constraints") or "") + extra_rules
                
            engine.run_eval_suite_sync(idea, context, runs=req_data.runs, user_id=user_id)
        except Exception as err:
            print(f"Error in evaluation background task: {err}")

    background_tasks.add_task(run_evaluation_task, req)
    return {"status": "pending"}


@app.post("/simulations/{id}/stress-constraints")
def generate_stress_constraints_endpoint(id: str, user_id: str = Depends(get_current_user)):
    from evaluation_engine import EvaluationEngine
    try:
        supabase = get_supabase()
        sim_resp = supabase.table("simulations").select("*").eq("id", id).eq("user_id", user_id).execute()
        if not sim_resp.data:
            raise HTTPException(status_code=404, detail="Simulation not found")
        sim = sim_resp.data[0]
        
        idea = sim.get("idea", "")
        plan = sim.get("business_plan", {}) or {}
        context = {
            "market": sim.get("market", ""),
            "target_audience": sim.get("target_audience", ""),
            "revenue_model": sim.get("revenue_model", ""),
            "constraints": sim.get("constraints", "")
        }
        
        engine = EvaluationEngine()
        scenarios = engine.generate_stress_constraints(idea, plan, context)
        return {"scenarios": scenarios}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/evaluations")
def list_evaluations(user_id: str = Depends(get_current_user)):
    try:
        supabase = get_supabase()
        response = supabase.table("evaluation_runs").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/simulations/{id}/feedback")
def submit_feedback(id: str, req: FeedbackRequest, user_id: str = Depends(get_current_user)):
    from evaluation_engine import EvaluationEngine
    try:
        supabase = get_supabase()
        sim_resp = supabase.table("simulations").select("*").eq("id", id).eq("user_id", user_id).execute()
        if not sim_resp.data:
            raise HTTPException(status_code=404, detail="Simulation not found")
        sim = sim_resp.data[0]
        
        lesson_data = None
        # The raw comment is never stored as a lesson: an LLM distils it into one short
        # general rule first, so one user can't inject instructions into everyone's runs.
        if req.comment:
            context = {
                "market": sim.get("market", ""),
                "target_audience": sim.get("target_audience", ""),
                "revenue_model": sim.get("revenue_model", ""),
                "constraints": sim.get("constraints", "")
            }
            lesson_data = EvaluationEngine().extract_lesson_from_feedback(
                idea=sim.get("idea", ""),
                feedback=req.comment,
                section=req.section,
                context=context,
                rating_impact=1 if req.rating_impact > 0 else -1,
            )

        return {"status": "success", "lesson_extracted": lesson_data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/lessons")
def list_lessons(user_id: str = Depends(get_current_user)):
    try:
        supabase = get_supabase()
        response = supabase.table("agent_lessons").select("*").order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Checklist / Accountability Endpoints ─────────────────

class ChecklistToggleRequest(BaseModel):
    category: str  # 'go_to_market' or 'product_mvp'
    item_index: int
    completed: bool


@app.get("/simulations/{simulation_id}/checklist")
def get_checklist(simulation_id: str, user_id: str = Depends(get_current_user)):
    """Get all checklist items for a simulation."""
    try:
        supabase = get_supabase()
        response = (
            supabase.table("checklist_items")
            .select("*")
            .eq("simulation_id", simulation_id)
            .eq("user_id", user_id)
            .order("category")
            .order("item_index")
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/simulations/{simulation_id}/checklist/initialize")
def initialize_checklist(simulation_id: str, user_id: str = Depends(get_current_user)):
    """Initialize checklist items from the simulation's business plan."""
    try:
        supabase = get_supabase()
        
        # Check if checklist already exists
        existing = (
            supabase.table("checklist_items")
            .select("id")
            .eq("simulation_id", simulation_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            return {"status": "already_initialized", "count": len(existing.data)}
        
        # Get the simulation's business plan
        sim = (
            supabase.table("simulations")
            .select("business_plan")
            .eq("id", simulation_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        if not sim.data or not sim.data.get("business_plan"):
            raise HTTPException(status_code=404, detail="Simulation or business plan not found")
        
        plan = sim.data["business_plan"]
        items_to_insert = []
        
        # Extract go_to_market items
        for i, item_text in enumerate(plan.get("go_to_market", [])):
            items_to_insert.append({
                "simulation_id": simulation_id,
                "user_id": user_id,
                "category": "go_to_market",
                "item_index": i,
                "item_text": item_text,
                "completed": False
            })
        
        # Extract product_mvp items
        for i, item_text in enumerate(plan.get("product_mvp", [])):
            items_to_insert.append({
                "simulation_id": simulation_id,
                "user_id": user_id,
                "category": "product_mvp",
                "item_index": i,
                "item_text": item_text,
                "completed": False
            })
        
        if items_to_insert:
            supabase.table("checklist_items").insert(items_to_insert).execute()
        
        return {"status": "initialized", "count": len(items_to_insert)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/simulations/{simulation_id}/checklist")
def toggle_checklist_item(
    simulation_id: str,
    req: ChecklistToggleRequest,
    user_id: str = Depends(get_current_user)
):
    """Toggle a checklist item's completed status."""
    try:
        supabase = get_supabase()
        
        from datetime import datetime
        update_data = {
            "completed": req.completed,
            "completed_at": datetime.utcnow().isoformat() if req.completed else None
        }
        
        response = (
            supabase.table("checklist_items")
            .update(update_data)
            .eq("simulation_id", simulation_id)
            .eq("user_id", user_id)
            .eq("category", req.category)
            .eq("item_index", req.item_index)
            .execute()
        )
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Checklist item not found")
        
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/simulations/{simulation_id}/checklist/progress")
def get_checklist_progress(simulation_id: str, user_id: str = Depends(get_current_user)):
    """Get progress summary for a simulation's checklist."""
    try:
        supabase = get_supabase()
        response = (
            supabase.table("checklist_items")
            .select("category,completed")
            .eq("simulation_id", simulation_id)
            .eq("user_id", user_id)
            .execute()
        )
        
        items = response.data
        total = len(items)
        completed = sum(1 for item in items if item["completed"])
        
        return {
            "total": total,
            "completed": completed,
            "percentage": round((completed / total) * 100) if total > 0 else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
