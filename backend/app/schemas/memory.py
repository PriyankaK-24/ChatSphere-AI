from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.common import MemoryText, UTCDatetime

Category = Literal["preference", "style", "interest", "context"]


class MemoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    content: str
    category: str
    source: str
    created_at: UTCDatetime
    updated_at: UTCDatetime


class MemoryCreate(BaseModel):
    content: MemoryText
    category: Category = "context"


class MemoryUpdate(BaseModel):
    content: MemoryText | None = None
    category: Category | None = None


class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    memory_enabled: bool
    speak_responses: bool


class SettingsUpdate(BaseModel):
    memory_enabled: bool | None = None
    speak_responses: bool | None = None
