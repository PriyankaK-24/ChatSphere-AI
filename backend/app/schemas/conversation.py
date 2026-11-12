from pydantic import BaseModel, ConfigDict

from app.schemas.common import ChatText, TitleText, UTCDatetime


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    content: str
    created_at: UTCDatetime


class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    created_at: UTCDatetime
    updated_at: UTCDatetime


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]


class ConversationUpdate(BaseModel):
    title: TitleText


class MessageCreate(BaseModel):
    content: ChatText
