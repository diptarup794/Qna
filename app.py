"""
QnA API and web UI (FastAPI + static frontend).

Local:
  pip install -r requirements.txt
  copy .env.example to .env and set SECRET_KEY and GROQ_API_KEY
  python app.py
  → http://127.0.0.1:8000

Docker / Render:
  See Dockerfile and DEPLOY.md.

Vercel discovers the ASGI app via the module-level ``app`` below.
Serverless limits: SQLite and uploads do not persist — prefer Render/Docker for production.
"""
import uvicorn

from backend.main import app

__all__ = ["app"]

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
