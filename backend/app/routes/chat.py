
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from app.db.session import SessionLocal
from app.dependencies import get_current_user
from app.models import Conversation
from app.models.user import User
from app.schemas.conversation import MessageCreate
from app.services.chat import TurnState, after_turn, run_turn

router = APIRouter(prefix="/conversations", tags=["chat"])


def _require_conversation(conversation_id: int, user_id: int) -> None:
    with SessionLocal() as db:
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.owner_id == user_id,
        ).first()

        if conversation is None:
            raise HTTPException(
                status_code=404,
                detail="Conversation not found.",
            )


def _stream(generator, state: TurnState) -> StreamingResponse:
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
        background=BackgroundTask(after_turn, state),
    )


@router.post("/{conversation_id}/stream")
async def stream_message(
    conversation_id: int,
    body: MessageCreate,
    current_user: User = Depends(get_current_user),
):
    _require_conversation(conversation_id, current_user.id)

    state = TurnState(
        user_id=current_user.id,
        extract_memory=True,
    )

    return _stream(
        run_turn(
            conversation_id,
            current_user.id,
            body.content,
            False,
            state,
        ),
        state,
    )


@router.post("/{conversation_id}/regenerate")
async def regenerate(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
):
    _require_conversation(conversation_id, current_user.id)

    state = TurnState(
        user_id=current_user.id,
        extract_memory=False,
    )

    return _stream(
        run_turn(
            conversation_id,
            current_user.id,
            None,
            True,
            state,
        ),
        state,
    )