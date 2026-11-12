
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models import Memory, utcnow
from app.models.user import User
from app.schemas.memory import MemoryCreate, MemoryOut, MemoryUpdate
from app.services.memory import MAX_MEMORIES
from app.services.text import is_sensitive

router = APIRouter(prefix="/memories", tags=["memory"])

_SENSITIVE_MSG = (
    "That looks like sensitive information (passwords, keys, card or ID numbers). "
    "ChatSphere does not store those as memories."
)


def _get_or_404(db: Session, memory_id: int, user_id: int) -> Memory:
    mem = db.scalars(
        select(Memory).where(
            Memory.id == memory_id,
            Memory.owner_id == user_id,
        )
    ).first()

    if mem is None:
        raise HTTPException(status_code=404, detail="Memory not found.")

    return mem


@router.get("", response_model=list[MemoryOut])
def list_memories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Memory)
        .where(Memory.owner_id == current_user.id)
        .order_by(Memory.updated_at.desc(), Memory.id.desc())
    )
    return db.scalars(stmt).all()


@router.post(
    "",
    response_model=MemoryOut,
    status_code=status.HTTP_201_CREATED,
)
def create_memory(
    body: MemoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if is_sensitive(body.content):
        raise HTTPException(status_code=422, detail=_SENSITIVE_MSG)

    total = (
        db.scalar(
            select(func.count())
            .select_from(Memory)
            .where(Memory.owner_id == current_user.id)
        )
        or 0
    )

    if total >= MAX_MEMORIES:
        raise HTTPException(
            status_code=409,
            detail="Memory limit reached. Delete some first.",
        )

    mem = Memory(
        owner_id=current_user.id,
        content=body.content,
        category=body.category,
        source="manual",
    )

    db.add(mem)
    db.commit()
    db.refresh(mem)

    return mem


@router.patch("/{memory_id}", response_model=MemoryOut)
def update_memory(
    memory_id: int,
    body: MemoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mem = _get_or_404(db, memory_id, current_user.id)

    if body.content is not None:
        if is_sensitive(body.content):
            raise HTTPException(status_code=422, detail=_SENSITIVE_MSG)
        mem.content = body.content

    if body.category is not None:
        mem.category = body.category

    mem.updated_at = utcnow()

    db.commit()
    db.refresh(mem)

    return mem


@router.delete(
    "/{memory_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_memory(
    memory_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mem = _get_or_404(db, memory_id, current_user.id)

    db.delete(mem)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def clear_memories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.execute(
        delete(Memory).where(Memory.owner_id == current_user.id)
    )
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)