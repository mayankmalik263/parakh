import json
import os
from datetime import datetime
from supabase_client import get_supabase

def save_state(state: dict, report: str, business_plan=None):
    os.makedirs("outputs", exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    idea_slug = state["startup_idea"][:20].replace(" ", "_").lower()
    filename = f"outputs/{idea_slug}_{timestamp}"
    
    state_with_report = {**state, "final_report": report}
    with open(f"{filename}.json", "w", encoding="utf-8") as f:
        json.dump(state_with_report, f, indent=2, ensure_ascii=False)
    
    with open(f"{filename}.txt", "w", encoding="utf-8") as f:
        f.write(report)
    
    print(f"\n[SAVE] Saved to: {filename}.json")
    print(f"[REPORT] Report saved to: {filename}.txt")
    
    plan_dict = None
    if business_plan is not None:
        plan_dict = business_plan.model_dump(mode='json')
        plan_path = f"{filename}_plan.json"
        with open(plan_path, "w", encoding="utf-8") as f:
            f.write(business_plan.model_dump_json(indent=2))
        print(f"[STRUCTURED] Structured plan saved to: {plan_path}")
        
    # Automatic background evaluation & alignment score calculation
    alignment_score = None
    if plan_dict:
        try:
            print("[EVALUATOR] Running automatic background evaluation...")
            from evaluation_engine import EvaluationEngine
            engine = EvaluationEngine()
            
            # Form context from state
            context = {
                "target_audience": state.get("target_audience", ""),
                "market": state.get("market", ""),
                "revenue_model": state.get("revenue_model", ""),
                "constraints": state.get("constraints", "")
            }
            
            # Compute scores. Adherence comes from the simulation's Critic (no extra LLM call).
            fin_score, fin_violations = engine.evaluate_financial_coherence(state["slices"], state["profile"])
            comp_score, comp_issues = engine.evaluate_completeness(plan_dict)
            adh_score = state["critic"].get("adherence_score", 0.0)
            adh_justification = state["critic"].get("verdict", "")

            alignment_score = round((fin_score + comp_score + adh_score) / 3.0, 2)
            print(f"[EVALUATOR] Scores -> Financial: {fin_score}, Completeness: {comp_score}, Adherence: {adh_score}")
            print(f"[EVALUATOR] Combined Alignment Score: {alignment_score}")

            # Only learn from runs that went wrong; reinforcing lessons every run would flood the table.
            scores = {
                "financial_coherence": fin_score,
                "completeness": comp_score,
                "constraint_adherence": adh_score
            }
            if min(scores.values()) < 0.85:
                engine.extract_and_save_lesson(state.get("startup_idea", ""), plan_dict, context, scores)

            # Save evaluation run record
            eval_record = {
                "user_id": state.get("user_id") or None,
                "idea": state.get("startup_idea", ""),
                "runs_count": 1,
                "avg_financial_coherence": fin_score,
                "avg_constraint_adherence": adh_score,
                "avg_completeness": comp_score,
                "avg_debate_rounds": float(state.get("revision", 0)),
                "consistency_score": 1.0,
                "detailed_metrics": {
                    "financial_scores": [fin_score],
                    "completeness_scores": [comp_score],
                    "adherence_scores": [adh_score],
                    "debate_rounds": [state.get("revision", 0)],
                    "financial_violations": fin_violations,
                    "completeness_issues": comp_issues,
                    "adherence_justification": adh_justification
                }
            }
            supabase = get_supabase()
            supabase.table("evaluation_runs").insert(eval_record).execute()
            print("[EVALUATOR] Saved evaluation record to database.")
            
        except Exception as eval_err:
            print(f"[EVALUATOR] Failed automatic background evaluation: {eval_err}")
    
    # Save to Supabase
    job_id = state.get("job_id")
    user_id = state.get("user_id")
    if job_id and user_id:
        try:
            supabase = get_supabase()
            record = {
                "user_id": user_id,
                "job_id": job_id,
                "idea": state.get("startup_idea", ""),
                "target_audience": state.get("target_audience", ""),
                "market": state.get("market", ""),
                "revenue_model": state.get("revenue_model", ""),
                "constraints": state.get("constraints", ""),
                "business_plan": plan_dict,
                "final_report": report,
                "alignment_score": alignment_score # Save alignment score
            }
            supabase.table("simulations").insert(record).execute()
            print(f"[SUPABASE] Simulation saved to database with alignment score {alignment_score}.")
        except Exception as e:
            print(f"[ERROR] Failed to save simulation to Supabase: {e}")
            
    return filename