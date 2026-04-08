"""ASGI entry — Vercel scans root ``main.py`` for a ``app`` binding."""
from backend.main import app as fastapi_app

app = fastapi_app

__all__ = ["app"]
