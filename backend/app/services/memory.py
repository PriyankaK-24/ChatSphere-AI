
"""Persistent memory: retrieval into prompts, and conservative auto-extraction."""

import json
import logging
import re

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import MEMORY_CATEGORIES, Memory
from app.services import ai
from app.services.text import is_sensitive, normalise, tokens
from app.services.user_settings import get_or_create_settings

log = logging.getLogger("chatsphere.memory")

MAX_MEMORIES = 200
PROMPT_LIMIT = 12
MIN_MESSAGE_CHARS = 12
MAX_NEW_PER_TURN = 3

_EXTRACT_SYSTEM = (
    "You extract long-term memories about a user from their chat message. "
    "Respond with JSON only."
)

_EXTRACT_PROMPT = """From the USER MESSAGE below, extract only durable facts the user \
stated about themselves that would help in future conversations:
- preference: things they like/dislike or want done a certain way
- style: how they want responses written (tone, length, format)
- interest: topics they frequently care about
- context: useful personal context (role, field, location at city level, goals)

Rules:
- Use only what the USER stated. Ignore anything only the assistant said.
- Skip one-off requests, questions, and temporary details.
- NEVER include passwords, PINs, API keys, financial details, ID numbers, health \
details, or other sensitive personal information.
- Write each memory as a short third-person sentence, e.g. "Prefers concise answers."
- Do not repeat anything in ALREADY SAVED.
- Return at most {max_items} items. If nothing qualifies, return [].

Output format: [{{"content": "...", "category": "preference|style|interest|context"}}]

ALREADY SAVED:
{existing}

USER MESSAGE:
{message}
"""


def retrieve_relevant(
    db: Session,
    user_id: int,
    query: str,
    limit: int = PROMPT_LIMIT,
) -> list[Memory]:
    """Retrieve only memories belonging to the specified user."""

    stmt = (
        select(Memory)
        .where(Memory.owner_id == user_id)
        .order_by(Memory.updated_at.desc())
    )
    memories = list(db.scalars(stmt))

    if len(memories) <= limit:
        return memories

    q = tokens(query)
    memories.sort(
        key=lambda m: (
            m.category in ("preference", "style"),
            len(q & tokens(m.content)),
            m.updated_at,
        ),
        reverse=True,
    )

    return memories[:limit]


def format_for_prompt(memories: list[Memory]) -> str:
    if not memories:
        return ""

    lines = "\n".join(f"- {m.content}" for m in memories)

    return (
        "\n\nSaved notes about the user (from earlier conversations). Use them only "
        "when relevant, follow stated style preferences, and do not mention these "
        "notes unless the user asks:\n" + lines
    )


def _parse_items(raw: str) -> list[dict]:
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []

    if not isinstance(data, list):
        return []

    return [d for d in data if isinstance(d, dict)]


async def extract_and_store(
    user_id: int,
    user_text: str,
    assistant_text: str,
) -> None:
    """Extract and store memories for one user only."""

    if len(user_text.strip()) < MIN_MESSAGE_CHARS:
        return

    with SessionLocal() as db:
        if not get_or_create_settings(db, user_id).memory_enabled:
            return

        existing = [
            m.content
            for m in db.scalars(
                select(Memory)
                .where(Memory.owner_id == user_id)
                .order_by(Memory.id.desc())
                .limit(50)
            )
        ]

        total = (
            db.scalar(
                select(func.count())
                .select_from(Memory)
                .where(Memory.owner_id == user_id)
            )
            or 0
        )

        db.commit()

    if total >= MAX_MEMORIES:
        return

    prompt = _EXTRACT_PROMPT.format(
        max_items=MAX_NEW_PER_TURN,
        existing="\n".join(f"- {c}" for c in existing) or "(none)",
        message=user_text[:2000],
    )

    try:
        raw = await ai.generate_json_text(prompt, _EXTRACT_SYSTEM)
    except ai.AIError:
        return

    known = {normalise(c) for c in existing}
    to_add: list[Memory] = []

    for item in _parse_items(raw)[:MAX_NEW_PER_TURN]:
        content = str(item.get("content", "")).strip()
        category = str(item.get("category", "context")).strip().lower()

        if category not in MEMORY_CATEGORIES:
            category = "context"

        if not content or len(content) > 300 or is_sensitive(content):
            continue

        key = normalise(content)

        if key in known:
            continue

        known.add(key)

        to_add.append(
            Memory(
                owner_id=user_id,
                content=content,
                category=category,
                source="auto",
            )
        )

    if to_add:
        with SessionLocal() as db:
            # Check the user's preference again after the AI call.
            if get_or_create_settings(db, user_id).memory_enabled:
                db.add_all(to_add)

            db.commit()