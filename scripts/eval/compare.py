"""
Side-by-side numbers for two eval labels, e.g.:
    python scripts/eval/compare.py baseline after-step-1
Only ideas that finished under both labels are compared.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load(label: str) -> dict:
    folder = HERE / "results" / label
    runs = (json.loads(p.read_text(encoding="utf-8")) for p in folder.glob("*.json"))
    return {r["id"]: r for r in runs if r.get("ok")}


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: compare.py <before-label> <after-label>")
    before, after = load(sys.argv[1]), load(sys.argv[2])
    common = sorted(set(before) & set(after))
    if not common:
        sys.exit("No idea finished under both labels.")
    metrics = {
        "Tokens": lambda r: r["tokens"]["total"],
        "Output tokens": lambda r: r["tokens"]["out"],
        "Time (s)": lambda r: r["seconds"],
        "Model calls": lambda r: len(r["calls"]),
        "Revision rounds": lambda r: r["scores"]["revisions"],
        "Unfixed math errors": lambda r: r["scores"]["math_warnings"],
        "Hidden costs": lambda r: len(r["scores"]["hidden_costs"]),
        "Unsourced stats": lambda r: len(r["scores"]["invented_stats"]),
    }
    print(f"{len(common)} ideas in both runs\n")
    print(f"{'Average per plan':<22}{sys.argv[1]:>14}{sys.argv[2]:>16}{'change':>10}")
    for name, f in metrics.items():
        a = sum(f(before[i]) for i in common) / len(common)
        b = sum(f(after[i]) for i in common) / len(common)
        change = f"{(b - a) / a * 100:+.0f}%" if a else "n/a"
        print(f"{name:<22}{a:>14,.1f}{b:>16,.1f}{change:>10}")


if __name__ == "__main__":
    main()
