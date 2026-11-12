
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models import Conversation
from app.models.user import User
from app.schemas.conversation import (
    ConversationDetail,
    ConversationOut,
    ConversationUpdate,
)

router = APIRouter(prefix="/conversations", tags=["conversations"])


def _get_or_404(
    db: Session,
    conversation_id: int,
    user_id: int,
) -> Conversation:
    conv = db.scalars(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.owner_id == user_id,
        )
    ).first()

    if conv is None:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found.",
        )

    return conv


@router.get("", response_model=list[ConversationOut])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Conversation)
        .where(Conversation.owner_id == current_user.id)
        .order_by(Conversation.updated_at.desc(), Conversation.id.desc())
    )
    return db.scalars(stmt).all()


@router.post(
    "",
    response_model=ConversationOut,
    status_code=status.HTTP_201_CREATED,
)
def create_conversation(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = Conversation(owner_id=current_user.id)

    db.add(conv)
    db.commit()
    db.refresh(conv)

    return conv


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = db.scalars(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.owner_id == current_user.id,
        )
        .options(selectinload(Conversation.messages))
    ).first()

    if conv is None:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found.",
        )

    return conv


@router.patch("/{conversation_id}", response_model=ConversationOut)
def rename_conversation(
    conversation_id: int,
    body: ConversationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = _get_or_404(db, conversation_id, current_user.id)

    conv.title = body.title
    db.commit()
    db.refresh(conv)

    return conv


@router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = _get_or_404(db, conversation_id, current_user.id)

    db.delete(conv)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)