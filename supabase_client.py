import os
from functools import lru_cache

from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """One client for the whole process. Building a new one per call opened a fresh HTTPS
    connection (and TLS handshake) to Supabase on every query, which made pages feel slow."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env")
    return create_client(SUPABASE_URL, SUPABASE_KEY)
