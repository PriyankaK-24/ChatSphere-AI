from datetime import datetime, timezone
from typing import Annotated

from pydantic import PlainSerializer, StringConstraints


def _iso_utc(value: datetime) -> str:
    # SQLite returns naive datetimes; they are always stored as UTC.
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


UTCDatetime = Annotated[datetime, PlainSerializer(_iso_utc, return_type=str)]

# Strips whitespace first, then enforces length, so "   " is rejected.
ChatText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=8000)]
TitleText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
MemoryText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
