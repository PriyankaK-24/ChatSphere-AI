"""Thin wrapper around the Google Gen AI SDK.

Errors are converted to AIError with a message that is safe to show users.
Neither API keys nor message content are ever logged.
"""
import logging
from collections.abc import AsyncIterator, Sequence

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from app.config import get_settings

log = logging.getLogger("chatsphere.ai")

_client: genai.Client | None = None


class AIError(Exception):
    def __init__(self, user_message: str, status: int | None = None):
        super().__init__(user_message)
        self.user_message = user_message
        self.status = status


def _get_client() -> genai.Client:
    global _client
    settings = get_settings()
    if not settings.gemini_api_key:
        raise AIError(
            "The Gemini API key is not configured. Add GEMINI_API_KEY to "
            "backend/.env and restart the server."
        )
    if _client is None:
        _client = genai.Client(
            api_key=settings.gemini_api_key,
            http_options=types.HttpOptions(timeout=45000),
        )
    return _client


def _map_api_error(exc: genai_errors.APIError) -> AIError:
    code = getattr(exc, "code", None)
    log.warning("Gemini API error: status=%s", code)
    if code == 429:
        return AIError("Gemini's rate limit was reached. Please wait a moment and try again.", 429)
    if code in (401, 403):
        return AIError(
            "Gemini rejected the API key. Check GEMINI_API_KEY in backend/.env.", code
        )
    if code == 404:
        return AIError("The configured Gemini model was not found. Check GEMINI_MODEL.", 404)
    if code == 400:
        return AIError("Gemini could not process this request. Try rephrasing it.", 400)
    if isinstance(code, int) and code >= 500:
        return AIError("Gemini is temporarily unavailable. Please try again shortly.", code)
    return AIError("Gemini returned an unexpected error. Please try again.", code)


def _to_contents(history: Sequence[tuple[str, str]]) -> list[types.Content]:
    return [
        types.Content(
            role="user" if role == "user" else "model",
            parts=[types.Part(text=content)],
        )
        for role, content in history
    ]


async def stream_reply(
    history: Sequence[tuple[str, str]], system_instruction: str
) -> AsyncIterator[str]:
    """Yields text pieces as Gemini generates them."""
    client = _get_client()
    config = types.GenerateContentConfig(system_instruction=system_instruction)
    produced = False
    try:
        stream = await client.aio.models.generate_content_stream(
            model=get_settings().gemini_model,
            contents=_to_contents(history),
            config=config,
        )
        async for chunk in stream:
            text = chunk.text
            if text:
                produced = True
                yield text
    except AIError:
        raise
    except genai_errors.APIError as exc:
        raise _map_api_error(exc) from None
    except Exception as exc:  # network failures, SDK errors, etc.
        log.warning("Gemini call failed: %s", type(exc).__name__)
        raise AIError("Could not reach Gemini. Check your connection and try again.") from None
    if not produced:
        raise AIError(
            "Gemini returned an empty response (it may have been blocked by safety "
            "filters). Try rephrasing your message."
        )


async def generate_json_text(prompt: str, system_instruction: str) -> str:
    """One-shot, non-streaming call that asks for a JSON response."""
    client = _get_client()
    try:
        response = await client.aio.models.generate_content(
            model=get_settings().gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                temperature=0,
            ),
        )
    except genai_errors.APIError as exc:
        raise _map_api_error(exc) from None
    except Exception as exc:
        log.warning("Gemini call failed: %s", type(exc).__name__)
        raise AIError("Could not reach Gemini.") from None
    return response.text or ""