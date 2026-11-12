
"""One chat turn: persist the user message, stream Gemini's reply as SSE
events, persist the reply, and (afterwards) extract memories.
"""

import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import SessionLocal
from app.models import Conversation, Message, utcnow
from app.services import ai, memory
from app.services.text import make_title
from app.services.user_settings import get_or_create_settings

log = logging.getLogger("chatsphere.chat")

HISTORY_LIMIT = 40
DEFAULT_TITLE = "New chat"

BASE_PROMPT = (
    "You are ChatSphere AI, a helpful, accurate and friendly assistant. Answer "
    "clearly and concisely. Use Markdown for structure, and fenced code blocks "
    "with a language tag for code. If you are unsure, say so rather than guessing."
)


class TurnError(Exception):
    """A problem detected before streaming starts."""


@dataclass
class TurnState:
    """Shared between the stream generator and the post-response task."""

    user_id: int
    extract_memory: bool = False
    user_text: str = ""
    assistant_text: str = ""
    completed: bool = False


@dataclass
class Prepared:
    history: list[tuple[str, str]] = field(default_factory=list)
    user_message_id: int = 0
    title: str = DEFAULT_TITLE
    system_prompt: str = BASE_PROMPT
    user_text: str = ""


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _load_history(db, conversation_id: int):
    rows = db.execute(
        select(Message.id, Message.role, Message.content)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.id.desc())
        .limit(HISTORY_LIMIT)
    ).all()

    rows.reverse()
    return rows


def _prepare(
    conversation_id: int,
    user_id: int,
    content: str | None,
    regenerate: bool,
) -> Prepared:
    with SessionLocal() as db:
        conv = db.scalars(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.owner_id == user_id,
            )
        ).first()

        if conv is None:
            raise TurnError("Conversation not found.")

        if regenerate:
            last = db.scalars(
                select(Message)
                .where(Message.conversation_id == conversation_id)
                .order_by(Message.id.desc())
                .limit(1)
            ).first()

            if last is not None and last.role == "assistant":
                db.delete(last)
                db.flush()

            history = _load_history(db, conversation_id)

            if not history or history[-1].role != "user":
                raise TurnError("There is nothing to regenerate.")

            user_message_id = history[-1].id
            user_text = history[-1].content

        else:
            msg = Message(
                conversation_id=conversation_id,
                role="user",
                content=content or "",
            )

            db.add(msg)
            conv.updated_at = utcnow()

            if conv.title == DEFAULT_TITLE:
                conv.title = make_title(content or "")

            db.flush()

            user_message_id = msg.id
            user_text = content or ""
            history = _load_history(db, conversation_id)

        system_prompt = BASE_PROMPT

        if get_or_create_settings(db, user_id).memory_enabled:
            relevant_memories = memory.retrieve_relevant(
                db,
                user_id,
                user_text,
            )
            system_prompt += memory.format_for_prompt(relevant_memories)

        db.commit()

        return Prepared(
            history=[(h.role, h.content) for h in history],
            user_message_id=user_message_id,
            title=conv.title,
            system_prompt=system_prompt,
            user_text=user_text,
        )


def _save_assistant(
    conversation_id: int,
    user_id: int,
    text: str,
) -> int | None:
    try:
        with SessionLocal() as db:
            conv = db.scalars(
                select(Conversation).where(
                    Conversation.id == conversation_id,
                    Conversation.owner_id == user_id,
                )
            ).first()

            if conv is None:
                return None

            msg = Message(
                conversation_id=conversation_id,
                role="assistant",
                content=text,
            )

            db.add(msg)
            conv.updated_at = utcnow()
            db.commit()

            return msg.id

    except SQLAlchemyError as exc:
        log.warning(
            "Could not save assistant message: %s",
            type(exc).__name__,
        )
        return None


async def run_turn(
    conversation_id: int,
    user_id: int,
    content: str | None,
    regenerate: bool,
    state: TurnState,
) -> AsyncIterator[str]:

    try:
        prepared = _prepare(
            conversation_id,
            user_id,
            content,
            regenerate,
        )

    except TurnError as exc:
        yield sse("error", {"message": str(exc)})
        return

    except SQLAlchemyError as exc:
        log.warning(
            "Database error preparing turn: %s",
            type(exc).__name__,
        )
        yield sse(
            "error",
            {"message": "A database error occurred. Please try again."},
        )
        return

    state.user_text = prepared.user_text

    yield sse(
        "meta",
        {
            "conversation_id": conversation_id,
            "user_message_id": prepared.user_message_id,
            "title": prepared.title,
        },
    )

    parts: list[str] = []
    error_message: str | None = None
    message_id: int | None = None

    try:
        async for piece in ai.stream_reply(
            prepared.history,
            prepared.system_prompt,
        ):
            parts.append(piece)
            yield sse("token", {"text": piece})

    except ai.AIError as exc:
        error_message = exc.user_message

    finally:
        # Preserve generated text even if the client disconnects.
        text = "".join(parts)

        if text.strip():
            message_id = _save_assistant(
                conversation_id,
                user_id,
                text,
            )

    if error_message:
        yield sse(
            "error",
            {
                "message": error_message,
                "message_id": message_id,
            },
        )
        return

    state.assistant_text = "".join(parts)
    state.completed = True

    yield sse("done", {"message_id": message_id})


async def after_turn(state: TurnState) -> None:
    """Background task that stores memories for the authenticated user."""

    if not (state.extract_memory and state.completed):
        return

    try:
        await memory.extract_and_store(
            state.user_id,
            state.user_text,
            state.assistant_text,
        )

    except Exception as exc:
        log.warning(
            "Memory extraction failed: %s",
            type(exc).__name__,
        )