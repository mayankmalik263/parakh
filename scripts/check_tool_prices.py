"""
Weekly check of tool_catalog.json: re-reads each tool's pricing page and reports which listed
prices can still be found there. It never edits the catalog; you review the report and update
prices by hand (with the new checked_on date).

Run from the repo root:
    python scripts/check_tool_prices.py              # plain HTTP fetch
    FIRECRAWL_API_KEY=... python scripts/check_tool_prices.py   # renders JavaScript pricing pages too

Writes scripts/price_check_report.md. Many pricing pages are built with JavaScript or vary by
country, so "not found" means "look at this one", not "the price changed".
"""
import json
import os
import re
import sys
import urllib.request
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "tool_catalog.json"
REPORT = ROOT / "scripts" / "price_check_report.md"
STALE_DAYS = 30


def fetch(url: str) -> str:
    key = os.getenv("FIRECRAWL_API_KEY")
    if key:
        # Firecrawl renders the page in a browser first. Endpoint per Firecrawl's v1 API docs.
        body = json.dumps({"url": url, "formats": ["markdown"], "onlyMainContent": True}).encode()
        req = urllib.request.Request("https://api.firecrawl.dev/v1/scrape", data=body,
                                     headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=90) as r:
            return json.loads(r.read())["data"]["markdown"]
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Parakh price check)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "ignore")


def figures(plan: dict) -> list[str]:
    """Price figures as they would appear on the page: 20 -> "20", 1590 -> "1,590" or "1590"."""
    out = []
    for key in ("usd", "inr"):
        v = plan.get(key)
        if v:
            n = f"{v:g}"
            out += [n, f"{v:,.0f}"] if v >= 1000 else [n]
    return out


def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    rows, pages = [], {}
    for tool in catalog["tools"]:
        url = tool.get("source")
        if not url:
            continue
        if url not in pages:
            try:
                pages[url] = re.sub(r"\s+", " ", fetch(url))
            except Exception as e:
                pages[url] = None
                print(f"  could not fetch {url}: {e}", file=sys.stderr)
        text = pages[url]
        age = (date.today() - datetime.strptime(tool.get("checked_on", "2000-01-01"), "%Y-%m-%d").date()).days
        for plan in tool["plans"]:
            if plan["period"] in ("free", "usage"):
                continue
            want = figures(plan)
            if text is None:
                status = "page did not load"
            elif any(re.search(rf"(?<![\d.,]){re.escape(f)}(?![\d,])", text) for f in want):
                status = "found"
            else:
                status = "NOT FOUND: check by hand"
            rows.append((tool["name"], plan["plan"], " / ".join(want), status, age))

    lines = ["# Tool price check", "", f"Run {date.today()} against tool_catalog.json (catalog checked {catalog['checked_on']}).", "",
             "| Tool | Plan | Price in catalog | On the page today | Days since checked |", "|---|---|---|---|---|"]
    order = {"NOT FOUND: check by hand": 0, "page did not load": 1, "found": 2}
    for name, plan, price, status, age in sorted(rows, key=lambda r: (order[r[3]], r[0])):
        lines.append(f"| {name} | {plan} | {price} | {status} | {age}{' (stale)' if age > STALE_DAYS else ''} |")
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    found = sum(1 for r in rows if r[3] == "found")
    print(f"{found}/{len(rows)} prices found on their pages. Report: {REPORT}")


if __name__ == "__main__":
    main()
