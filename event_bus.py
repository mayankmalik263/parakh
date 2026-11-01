"""
Event bus for streaming agent activity to the frontend via SSE.

Each simulation job gets its own asyncio.Queue.
- Agent nodes call `publish(job_id, event)` synchronously.
- The SSE endpoint calls `subscribe(job_id)` to get the queue,
  then awaits events from it.
"""

import asyncio
import json
import time
from threading import Lock
from typing import Any, Dict, Optional


_channels: Dict[str, asyncio.Queue] = {}
_loops: Dict[str, asyncio.AbstractEventLoop] = {}
_lock = Lock()


def create_channel(job_id: str, loop: asyncio.AbstractEventLoop) -> asyncio.Queue:
    """Create an event channel for a job. Called from the async SSE endpoint."""
    with _lock:
        q = asyncio.Queue()
        _channels[job_id] = q
        _loops[job_id] = loop
        return q


def subscribe(job_id: str) -> Optional[asyncio.Queue]:
    """Get the event queue for a job (returns None if not created yet)."""
    with _lock:
        return _channels.get(job_id)


def publish(job_id: str, event: Dict[str, Any]) -> None:
    """
    Publish an event to a job's channel.
    Safe to call from synchronous code (LangGraph node functions).
    """
    event["timestamp"] = time.time()

    with _lock:
        q = _channels.get(job_id)
        loop = _loops.get(job_id)

    if q is None or loop is None:
        # No subscriber yet — silently drop (job might not have SSE listener)
        return

    # Thread-safe put into the asyncio queue
    loop.call_soon_threadsafe(q.put_nowait, event)


def cleanup(job_id: str) -> None:
    """Remove a job's channel after it's done."""
    with _lock:
        _channels.pop(job_id, None)
        _loops.pop(job_id, None)
