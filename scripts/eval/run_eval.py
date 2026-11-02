"""
Runs Parakh's whole agent pipeline on the fixed test set and records tokens, time and quality.

Nothing is saved to Supabase and past "lessons" are switched off, so runs are comparable.
Run from the repo root with the venv active:

    python scripts/eval/run_eval.py --label baseline            # all 12 ideas, about an hour
    python scripts/eval/run_eval.py --label baseline --only notes-juniors,reels-cafes

Writes scripts/eval/results/<label>/<idea>.json (plan + scores), a log per idea, and
scripts/eval/results/<label>/SUMMARY.md. Compare two labels with:

    python scripts/eval/compare.py baseline after-step-1
"""
import argparse
import contextlib
import io
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(HERE))

import graph_orchestrator as go  # noqa: E402
from agents.llm_router import MODEL, summarize_usage, token_meter  # noqa: E402
from metrics import catalog_names, score  # noqa: E402

# No database writes, no live events, no lessons: the same input must mean the same conditions.
go.save_state = lambda *a, **k: None
go.get_lessons_from_db = lambda profile: []
go.event_bus.publish = lambda *a, **k: None


def run_one(item: dict, out_dir: Path, catalog: list[str]) -> dict:
    log = io.StringIO()
    started = time.monotonic()
    record = {"id": item["id"], "kind": item["kind"], "idea": item["idea"], "model": MODEL}
    with token_meter() as calls, contextlib.redirect_stdout(log):
        try:
            final = go.run(item["idea"], {"market": item["market"], "constraints": item["constraints"]})
            record["ok"] = True
            record["scores"] = score(final, f"{item['idea']} {item['constraints']}", catalog)
            record["slices"] = final["slices"]
            record["critic"] = final.get("critic", {})
        except Exception as e:  # one failed idea must not stop the set
            record["ok"] = False
            record["error"] = f"{type(e).__name__}: {e}"
    record["seconds"] = round(time.monotonic() - started, 1)
    record["calls"] = calls
    record["tokens"] = {
        "in": sum(c["in"] for c in calls),
        "out": sum(c["out"] for c in calls),
        "thinking": sum(c["thinking"] for c in calls),
    }
    record["tokens"]["total"] = record["tokens"]["in"] + record["tokens"]["out"]
    (out_dir / f"{item['id']}.json").write_text(json.dumps(record, ensure_ascii=False, indent=1), encoding="utf-8")
    (out_dir / f"{item['id']}.log").write_text(log.getvalue(), encoding="utf-8")
    print(f"  {item['id']:<28} {'ok ' if record['ok'] else 'ERR'} {record['seconds']:>6.0f}s  {summarize_usage(calls)}")
    if not record["ok"]:
        print(f"    {record['error']}")
    return record


def summary(label: str, records: list[dict]) -> str:
    ok = [r for r in records if r["ok"]]
    n = len(ok) or 1
    avg = lambda f: sum(f(r) for r in ok) / n  # noqa: E731
    lines = [
        f"# Eval: {label}",
        "",
        f"scored {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC · model `{records[0]['model'] if records else '?'}` · "
        f"{len(ok)}/{len(records)} plans finished",
        "",
        "| | Average per plan |",
        "|---|---|",
        f"| Tokens | {avg(lambda r: r['tokens']['total']):,.0f} ({avg(lambda r: r['tokens']['in']):,.0f} in, {avg(lambda r: r['tokens']['out']):,.0f} out) |",
        f"| Thinking tokens | {avg(lambda r: r['tokens']['thinking']):,.0f} |",
        f"| Model calls | {avg(lambda r: len(r['calls'])):.1f} |",
        f"| Time | {avg(lambda r: r['seconds']):,.0f}s |",
        f"| Revision rounds | {avg(lambda r: r['scores']['revisions']):.2f} |",
        f"| Unfixed math errors | {avg(lambda r: r['scores']['math_warnings']):.2f} |",
        f"| Costed tools we can price-check | {sum(r['scores']['tools_in_catalog'] for r in ok)}/{sum(r['scores']['tools_costed'] for r in ok)} |",
        f"| Recommended tools missing from costs | {avg(lambda r: len(r['scores']['hidden_costs'])):.1f} |",
        f"| Stats with no source | {avg(lambda r: len(r['scores']['invented_stats'])):.1f} |",
        "",
        "| Idea | Tokens | Time | Rounds | Hidden costs | Unsourced stats |",
        "|---|---|---|---|---|---|",
    ]
    for r in records:
        if not r["ok"]:
            lines.append(f"| {r['id']} | failed: {r['error'][:80]} | | | | |")
            continue
        s = r["scores"]
        lines.append(f"| {r['id']} | {r['tokens']['total']:,} | {r['seconds']:.0f}s | {s['revisions']} | "
                     f"{len(s['hidden_costs'])} | {len(s['invented_stats'])} |")
    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--label", required=True, help="name for this run, e.g. baseline")
    ap.add_argument("--only", default="", help="comma-separated idea ids")
    args = ap.parse_args()

    ideas = json.loads((HERE / "ideas.json").read_text(encoding="utf-8"))["ideas"]
    if args.only:
        wanted = set(args.only.split(","))
        ideas = [i for i in ideas if i["id"] in wanted]
    out_dir = HERE / "results" / args.label
    out_dir.mkdir(parents=True, exist_ok=True)
    catalog = catalog_names()

    print(f"Running {len(ideas)} idea(s) on {MODEL} -> {out_dir}")
    for item in ideas:
        run_one(item, out_dir, catalog)
    # The summary covers every idea run under this label so far, so --only runs add up.
    records = load(out_dir)
    (out_dir / "SUMMARY.md").write_text(summary(args.label, records), encoding="utf-8")
    print(f"\n{summary(args.label, records)}")


def load(out_dir: Path) -> list[dict]:
    return [json.loads(p.read_text(encoding="utf-8")) for p in sorted(out_dir.glob("*.json"))]


if __name__ == "__main__":
    main()
