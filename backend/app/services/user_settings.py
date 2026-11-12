
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import UserSettings


def get_or_create_settings(db: Session, user_id: int) -> UserSettings:
    """Get or create settings belonging to a specific user."""

    stmt = select(UserSettings).where(UserSettings.user_id == user_id)
    row = db.scalars(stmt).first()

    if row is None:
        row = UserSettings(
            user_id=user_id,
            memory_enabled=True,
            speak_responses=False,
        )
        db.add(row)
        db.flush()

    return row