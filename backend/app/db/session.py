"""Engine and session factory.

SQLite is the default. Switching to PostgreSQL later only needs a different
DATABASE_URL (plus a driver such as psycopg); nothing else in the app touches
SQLite-specific APIs except the PRAGMA block below.
"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.db.base import Base

_settings = get_settings()
_is_sqlite = _settings.database_url.startswith("sqlite")

engine = create_engine(
    _settings.database_url,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
)

if _is_sqlite:

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")  # enforce FK + ON DELETE CASCADE
        cursor.execute("PRAGMA journal_mode=WAL")  # readers don't block the writer
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    """FastAPI dependency for ordinary (non-streaming) routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    import app.models  # noqa: F401  (registers tables on Base.metadata)

    Base.metadata.create_all(bind=engine)
