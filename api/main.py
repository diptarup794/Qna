"""Alternate entry — ``api/main.py`` is in Vercel’s FastAPI entrypoint list."""
from backend.main import app as fastapi_app

app = fastapi_app

__all__ = ["app"]
