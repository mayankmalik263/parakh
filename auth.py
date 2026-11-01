from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase_client import get_supabase

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    """
    FastAPI dependency that extracts the JWT token from the Authorization header,
    verifies it against Supabase Auth, and returns the user's UUID.
    """
    token = credentials.credentials
    supabase = get_supabase()
    
    try:
        # Verify the token by fetching the user profile from Supabase
        user_response = supabase.auth.get_user(token)
        
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
            
        return user_response.user.id
        
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

def get_optional_user(credentials: HTTPAuthorizationCredentials | None = Security(HTTPBearer(auto_error=False))) -> str | None:
    """
    FastAPI dependency that optionally extracts the JWT token.
    If no token is provided, returns None (for free demo mode).
    """
    if not credentials:
        return None
        
    token = credentials.credentials
    supabase = get_supabase()
    
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            return None
        return user_response.user.id
    except:
        return None
