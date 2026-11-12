from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.conversation import utcnow

MEMORY_CATEGORIES = ("preference", "style", "interest", "context")


class Memory(Base):
    """Durable facts about the user. Deliberately separate from chat messages."""

    __tablename__ = "memories"
    __table_args__ = (
        CheckConstraint(
            "category IN ('preference', 'style', 'interest', 'context')",
            name="ck_memory_category",
        ),
        CheckConstraint("source IN ('auto', 'manual')", name="ck_memory_source"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    content: Mapped[str] = mapped_column(String(300))
    category: Mapped[str] = mapped_column(String(16), default="context")
    source: Mapped[str] = mapped_column(String(8), default="auto")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )