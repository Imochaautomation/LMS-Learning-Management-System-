from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import LoginRequest, LoginResponse, UserOut
from auth import verify_password, create_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


ROLE_PRIORITY = {"manager": 0, "admin": 1, "employee": 2, "new_joiner": 3}

@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    query = db.query(User).filter(User.email == req.email)
    if req.role:
        query = query.filter(User.role == req.role)
    users = query.all()
    user = next((u for u in users if verify_password(req.password, u.password_hash)), None)
    if not user:
        # Try all accounts for this email if role-filtered search found nothing
        if req.role:
            all_users = db.query(User).filter(User.email == req.email).all()
            user = next((u for u in all_users if verify_password(req.password, u.password_hash)), None)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")
    # If multiple matches (same email, same password set for both accounts) pick by priority
    matching = [u for u in users if verify_password(req.password, u.password_hash)]
    if len(matching) > 1:
        user = min(matching, key=lambda u: ROLE_PRIORITY.get(u.role, 99))
    token = create_token(user.id)
    out = UserOut.model_validate(user)
    if user.manager:
        out.manager_name = user.manager.name
        out.manager_department = user.manager.department
    return LoginResponse(token=token, user=out)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    out = UserOut.model_validate(user)
    if user.manager:
        out.manager_name = user.manager.name
        out.manager_department = user.manager.department
    return out
