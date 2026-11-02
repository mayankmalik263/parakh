"""
Asks BharatCode one small question twice, with thinking on and with thinking off, and prints what
came back: finish reason, token counts and how much of the reply was thinking. Never prints your key.

Run from the repo root with the venv active:
    python scripts/probe_bharatcode.py
"""
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)

key = (os.environ.get("BHARATCODE_API_KEY") or "").strip().strip('"').strip("'")
if not key:
    sys.exit("BHARATCODE_API_KEY is not set in .env")
base_url = os.getenv("BHARATCODE_BASE_URL", "https://bharatcode.ai/api/model/v1").rstrip("/")
model = os.getenv("PARAKH_MODEL", "qwen-3.8-27b")
client = OpenAI(api_key=key, base_url=base_url, max_retries=0, timeout=180)

PROMPT = (
    'A student sells exam notes at Rs 149. Each sale costs Rs 25 to deliver. Monthly costs are Rs 2,500. '
    'How many sales a month to break even? Respond with ONLY a JSON object: {"break_even": <int>, "why": "<one line>"}'
)

for label, extra in (("thinking ON (Qwen default)", None), ("thinking OFF (chat_template_kwargs)", {"chat_template_kwargs": {"enable_thinking": False}})):
    print(f"\n=== {label} ===")
    kwargs = {"model": model, "messages": [{"role": "user", "content": PROMPT}], "max_tokens": 1500,
              "temperature": 0.7, "top_p": 0.8, "response_format": {"type": "json_object"}}
    if extra:
        kwargs["extra_body"] = extra
    started = time.monotonic()
    try:
        resp = client.chat.completions.create(**kwargs)
    except Exception as e:
        print(f"request failed: {type(e).__name__}: {e}")
        continue
    choice = resp.choices[0]
    msg = choice.message
    content = msg.content or ""
    reasoning = getattr(msg, "reasoning_content", None) or getattr(msg, "reasoning", None) or ""
    usage = resp.usage
    details = getattr(usage, "completion_tokens_details", None) if usage else None
    print(f"time:            {time.monotonic() - started:.1f}s")
    print(f"finish_reason:   {choice.finish_reason}")
    if usage:
        print(f"tokens:          in={usage.prompt_tokens} out={usage.completion_tokens} "
              f"reasoning={getattr(details, 'reasoning_tokens', None) if details else None}")
    print(f"content chars:   {len(content)}  (starts with <think>: {content.lstrip().startswith('<think>')})")
    print(f"reasoning field: {len(reasoning)} chars")
    print(f"content preview: {content[-200:]!r}")
