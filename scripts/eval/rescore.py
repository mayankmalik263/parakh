"""
Re-scores saved plans with the current metrics.py, without calling the model again.
Use it after improving a metric so old and new runs are judged the same way:
    python scripts/eval/rescore.py baseline
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parents[1]))

from metrics import catalog_names, score  # noqa: E402
from run_eval import load, summary  # noqa: E402


def main():
    label = sys.argv[1]
    out_dir = HERE / "results" / label
    ideas = {i["id"]: i for i in json.loads((HERE / "ideas.json").read_text(encoding="utf-8"))["ideas"]}
    catalog = catalog_names()
    for path in sorted(out_dir.glob("*.json")):
        r = json.loads(path.read_text(encoding="utf-8"))
        if not r.get("ok"):
            continue
        item = ideas[r["id"]]
        state = {"slices": r["slices"], "revision": r["scores"]["revisions"],
                 "conflicts": [None] * r["scores"]["issues_raised"], "math_warnings": [None] * r["scores"]["math_warnings"]}
        r["scores"] = score(state, f"{item['idea']} {item['constraints']}", catalog)
        path.write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
    records = load(out_dir)
    (out_dir / "SUMMARY.md").write_text(summary(label, records), encoding="utf-8")
    print(summary(label, records))


if __name__ == "__main__":
    main()
