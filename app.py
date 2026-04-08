"""
Run the QnA API and web UI (FastAPI + static frontend).

Local:
  pip install -r requirements.txt
  copy .env.example to .env and set SECRET_KEY and GROQ_API_KEY
  python app.py
  → http://127.0.0.1:8000

Docker:
  docker compose up --build
  → http://127.0.0.1:8000

See DEPLOY.md for cloud platforms (Railway, Fly.io, Render).
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
