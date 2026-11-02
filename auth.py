import base64
import json
import threading
import time

from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase_client import get_supabase

security = HTTPBearer()

# Verified tokens, so a page that makes five API calls asks Supabase Auth once, not five times.
# An entry lives at most CACHE_S seconds and never past the token's own expiry.
CACHE_S = 300
_verified: dict[str, tuple[str, float]] = {}
_lock = threading.Lock()


def _expiry(token: str) -> float:
    """The token's exp claim (read only to bound the cache; Supabase did the real check)."""
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return float(json.loads(base64.urlsafe_b64decode(payload))["exp"])
    except Exception:
        return 0.0


def _verify(token: str) -> str | None:
    now = time.time()
    with _lock:
        hit = _verified.get(token)
        if hit and hit[1] > now:
            return hit[0]
    user_response = get_supabase().auth.get_user(token)
    if not user_response or not user_response.user:
        return None
    user_id = user_response.user.id
    with _lock:
        if len(_verified) > 5000:  # tokens of visitors long gone
            for t in [t for t, (_, until) in _verified.items() if until <= now]:
                del _verified[t]
        _verified[token] = (user_id, min(now + CACHE_S, _expiry(token) or now + CACHE_S))
    return user_id


def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    """
    FastAPI dependency that extracts the JWT token from the Authorization header,
    verifies it against Supabase Auth, and returns the user's UUID.
    """
    try:
        user_id = _verify(credentials.credentials)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id


def get_optional_user(credentials: HTTPAuthorizationCredentials | None = Security(HTTPBearer(auto_error=False))) -> str | None:
    """
    FastAPI dependency that optionally extracts the JWT token.
    If no token is provided, returns None (for free demo mode).
    """
    if not credentials:
        return None
    try:
        return _verify(credentials.credentials)
    except Exception:
        return None
