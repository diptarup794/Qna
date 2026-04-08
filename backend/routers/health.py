from fastapi import APIRouter

from backend.config import get_settings
from backend.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/api/health", response_model=HealthResponse)
def health():
    s = get_settings()
    return HealthResponse(status="ok", groq_configured=bool(s.groq_api_key))
