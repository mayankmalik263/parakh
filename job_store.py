import uuid
from enum import Enum
from threading import Lock

class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    ERROR = "error"

_jobs = {}
_lock = Lock()

def create_job(user_id: str | None = None) -> str:
    job_id = str(uuid.uuid4())
    with _lock:
        _jobs[job_id] = {
            "user_id": user_id,
            "status": JobStatus.PENDING,
            "result": None,
            "error": None
        }
    return job_id

def update_job(job_id: str, **kwargs):
    with _lock:
        if job_id in _jobs:
            _jobs[job_id].update(kwargs)

def get_job(job_id: str):
    with _lock:
        return _jobs.get(job_id)