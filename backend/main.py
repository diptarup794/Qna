from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from backend.database import init_db
from backend.routers import auth, documents, health, qa

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="QnA PDF Assistant", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(qa.router)

_static_dir = Path(__file__).resolve().parent.parent / "static"
if _static_dir.is_dir():
    app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")


@app.get("/")
async def serve_app():
    index = Path(__file__).resolve().parent.parent / "static" / "index.html"
    if index.is_file():
        return FileResponse(index)
    return {"detail": "Frontend not built. Add static/index.html"}


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    ico = _static_dir / "favicon.ico"
    if ico.is_file():
        return FileResponse(ico)
    return Response(status_code=204)
