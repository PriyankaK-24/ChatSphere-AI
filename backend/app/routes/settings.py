
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.memory import SettingsOut, SettingsUpdate
from app.services.user_settings import get_or_create_settings

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsOut)
def read_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = get_or_create_settings(db, current_user.id)
    db.commit()
    return row


@router.patch("", response_model=SettingsOut)
def update_settings(
    body: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = get_or_create_settings(db, current_user.id)

    for key, value in body.model_dump(exclude_none=True).items():
        setattr(row, key, value)

    db.commit()
    db.refresh(row)

    return row