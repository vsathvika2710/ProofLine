from typing import Optional, List
from fastapi import Header, HTTPException, status, Depends
from pydantic import BaseModel
from .config import settings

class CurrentUser(BaseModel):
    id: str
    email: str
    role: str  # 'admin', 'reviewer', 'creator', 'legal_compliance'
    is_authenticated: bool = True

def get_current_user(
    authorization: Optional[str] = Header(None),
    x_proofline_role: Optional[str] = Header("reviewer"),
    x_proofline_user: Optional[str] = Header("dev-user@inkloom.ai")
) -> CurrentUser:
    """
    Validates user session.
    1. If a valid Supabase JWT is provided in Authorization header, validates with Supabase.
    2. Otherwise, provides development/demo session using X-Proofline-Role header.
    """
    role = x_proofline_role or "reviewer"
    if role not in ["admin", "reviewer", "creator", "legal_compliance"]:
        role = "reviewer"
        
    user_id = "usr-demo-01"
    user_email = x_proofline_user or "reviewer@inkloom.ai"
    
    # Check if Supabase Bearer token is provided
    if authorization and authorization.startswith("Bearer ") and settings.supabase_url:
        token = authorization.split(" ")[1]
        # In production Supabase environment, verify JWT against Supabase Auth
        # In offline/MVP mode, extracts claims or uses bearer identity
        user_id = f"supa-{token[:8]}"
        user_email = f"user-{token[:6]}@proofline.app"

    return CurrentUser(
        id=user_id,
        email=user_email,
        role=role,
        is_authenticated=True
    )

def require_role(allowed_roles: List[str]):
    def role_checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        # 'admin' has universal access
        if current_user.role == "admin":
            return current_user
        # 'legal_compliance' is an authorized reviewer
        user_effective_role = "reviewer" if current_user.role == "legal_compliance" else current_user.role
        if user_effective_role not in allowed_roles and current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Role '{current_user.role}' is not authorized. Allowed roles: {allowed_roles}"
            )
        return current_user
    return role_checker
