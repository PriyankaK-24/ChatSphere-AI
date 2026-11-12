from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    s = get_settings()
    # Report only whether a key is configured, never the key itself.
    return {
        "status": "ok",
        "app": s.app_name,
        "gemini_configured": bool(s.gemini_api_key),
    }
