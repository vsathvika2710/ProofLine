import json
import logging
import os
import urllib.parse
import urllib.request
import urllib.error
from typing import Optional, List, Dict, Any

from fastapi import Header, HTTPException, status, Depends
from pydantic import BaseModel

from .config import settings

logger = logging.getLogger(__name__)

VALID_ROLES = {"creator", "reviewer", "admin"}
VALID_GLOBAL_ROLES = {"employee", "super_admin"}


class CurrentUser(BaseModel):
    id: str
    email: str
    role: str = "reviewer"
    is_authenticated: bool = True
    account_type: str = "employee"
    organization_id: Optional[str] = None
    available_roles: List[str] = []
    requires_role_selection: bool = False
    global_role: str = "employee"


# Initial runtime allowlist is intentionally empty. Tests and administrators can
# register identities through the protected admin helper below.
_authorized_identities: Dict[str, Dict[str, Any]] = {}
_evaluation_accounts: Dict[str, Dict[str, Any]] = {}


def add_evaluation_account(email: str, roles: List[str], is_active: bool = True, expires_at: Optional[str] = None) -> Dict[str, Any]:
    normalized = normalize_email(email)
    bad_roles = set(roles) - VALID_ROLES
    if bad_roles:
        raise ValueError("Invalid evaluation role")
    record = {
        "normalized_email": normalized,
        "roles": sorted(set(roles)),
        "is_active": is_active,
        "expires_at": expires_at,
    }
    _evaluation_accounts[normalized] = record
    return record


def normalize_email(email: str) -> str:
    return email.strip().lower()


def add_authorized_identity(
    email: str,
    account_type: str,
    organization_id: Optional[str],
    roles: List[str],
    is_active: bool = True,
    global_role: str = "employee",
) -> Dict[str, Any]:
    normalized = normalize_email(email)
    bad_roles = set(roles) - VALID_ROLES
    if account_type not in {"employee", "judge_demo"}:
        raise ValueError("account_type must be employee or judge_demo")
    if global_role not in VALID_GLOBAL_ROLES:
        raise ValueError("Invalid global role")
    if bad_roles:
        raise ValueError("Invalid role")
    if account_type == "employee" and not roles:
        raise ValueError("An employee must have at least one assigned role")
    if account_type == "employee" and not organization_id:
        raise ValueError("An employee must have an organization context")
    if account_type == "judge_demo" and global_role != "employee":
        raise ValueError("Evaluation accounts cannot have a global role")
    if global_role == "super_admin" and account_type != "employee":
        raise ValueError("A super admin must use an employee identity")
    record = {
        "normalized_email": normalized,
        "account_type": account_type,
        "organization_id": organization_id,
        "roles": sorted(set(roles)),
        "is_active": is_active,
        "global_role": global_role,
    }
    _authorized_identities[normalized] = record
    return record


def deactivate_authorized_identity(email: str) -> bool:
    record = _authorized_identities.get(normalize_email(email))
    if not record:
        return False
    record["is_active"] = False
    return True


def _supabase_user(token: str) -> Dict[str, Any]:
    if not settings.supabase_url:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Office sign-in is not configured")
    req = urllib.request.Request(
        f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
        headers={
            "Authorization": f"Bearer {token}",
            "apikey": settings.supabase_anon_key or settings.supabase_service_role_key,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 403):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired sign-in") from exc
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not verify sign-in") from exc
    except (urllib.error.URLError, TimeoutError):
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not verify sign-in")


def _supabase_auth_request(path: str, method: str, payload: Optional[Dict[str, Any]] = None, token: Optional[str] = None) -> Dict[str, Any]:
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Office sign-in is not configured")
    headers = {
        "apikey": settings.supabase_anon_key,
        "Content-Type": "application/json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        f"{settings.supabase_url.rstrip('/')}{path}",
        data=body,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as response:
            response_body = response.read().decode("utf-8")
            return json.loads(response_body) if response_body else {}
    except urllib.error.HTTPError as exc:
        if exc.code in (400, 401, 403):
            logger.info("Supabase authentication request rejected (http_status=%s)", exc.code)
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password") from exc
        if exc.code == 429:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many sign-in attempts. Try again later.") from exc
        logger.error("Supabase authentication request failed (http_status=%s)", exc.code)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Office authentication service is unavailable") from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        logger.error("Supabase authentication request failed (%s)", type(exc).__name__)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Office authentication service is unavailable")


def supabase_password_login(email: str, password: str) -> Dict[str, Any]:
    normalized = normalize_email(email)
    token_payload = _supabase_auth_request(
        "/auth/v1/token?grant_type=password",
        "POST",
        {"email": normalized, "password": password},
    )
    if not token_payload.get("access_token") or not token_payload.get("refresh_token"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return token_payload


def supabase_logout(token: str) -> None:
    _supabase_auth_request("/auth/v1/logout", "POST", {}, token)


def _find_authorized_identity(email: str) -> Optional[Dict[str, Any]]:
    normalized = normalize_email(email)
    in_memory = _authorized_identities.get(normalized)
    if in_memory:
        return in_memory

    # Production lookup is performed in Supabase/PostgREST from tables in schema.sql.
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.error(
            "Supabase Office authorization lookup is not configured "
            "(url_configured=%s, service_role_configured=%s)",
            bool(settings.supabase_url),
            bool(settings.supabase_service_role_key),
        )
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Office authorization service is unavailable",
        )

    url = (
        f"{settings.supabase_url.rstrip('/')}/rest/v1/authorized_identities"
        f"?select=id,normalized_email,account_type,global_role,is_active,"
        f"organization_memberships(organization_id,assigned_role,membership_status)"
        f"&normalized_email=eq.{urllib.parse.quote(normalized)}"
    )
    req = urllib.request.Request(
        url,
        headers={
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            rows = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        provider_code = "unknown"
        try:
            error_body = json.loads(exc.read().decode("utf-8"))
            if isinstance(error_body, dict):
                candidate_code = error_body.get("code")
                if isinstance(candidate_code, str) and candidate_code.isascii() and candidate_code.isalnum():
                    provider_code = candidate_code[:32]
        except (UnicodeDecodeError, json.JSONDecodeError):
            pass
        finally:
            exc.close()
        logger.error(
            "Supabase Office authorization lookup failed (http_status=%s, provider_code=%s)",
            exc.code,
            provider_code,
        )
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Office authorization service is unavailable",
        ) from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        logger.error("Supabase Office authorization lookup failed (%s)", type(exc).__name__)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Office authorization service is unavailable",
        ) from exc

    if not isinstance(rows, list):
        logger.error("Supabase Office authorization lookup returned an unexpected response")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Office authorization service returned an invalid response",
        )
    if not rows:
        return None
    row = rows[0]
    if not row.get("is_active"):
        return None
    memberships = row.get("organization_memberships") or []
    active = [m for m in memberships if m.get("membership_status") == "active"]
    roles = sorted({m["assigned_role"] for m in active if m.get("assigned_role")})
    organizations = {m["organization_id"] for m in active if m.get("organization_id")}
    global_role = row.get("global_role") or "employee"
    if global_role not in VALID_GLOBAL_ROLES:
        logger.warning("Supabase Office identity has an unsupported global role")
        return None
    if row["account_type"] == "employee" and (len(organizations) != 1 or not roles):
        logger.warning("Active Office identity has no valid active workspace assignment")
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "This Office account has no active workspace authorization",
        )
    organization_id = next(iter(organizations)) if len(organizations) == 1 else None
    return {
        "normalized_email": normalized,
        "account_type": row["account_type"],
        "organization_id": organization_id,
        "roles": roles,
        "is_active": True,
        "global_role": global_role,
    }


def get_current_user(
    authorization: Optional[str] = Header(None),
    x_proofline_active_role: Optional[str] = Header(None),
) -> CurrentUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in is required")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in is required")

    auth_user = _supabase_user(token)
    email = normalize_email(auth_user.get("email", ""))
    user_id = auth_user.get("id")
    if not email or not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Could not verify your identity")

    identity = _find_authorized_identity(email)
    if not identity:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is not authorized for Office Workspace")
    if not identity["is_active"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This Office account is inactive")

    roles = identity["roles"]
    account_type = identity["account_type"]
    global_role = identity.get("global_role") or "employee"
    if account_type == "employee":
        if not roles or not identity.get("organization_id"):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "The employee workspace is not configured")
        if x_proofline_active_role:
            requested_role = x_proofline_active_role.lower()
            if requested_role not in roles:
                raise HTTPException(status.HTTP_403_FORBIDDEN, "This workspace is not authorized")
            role = requested_role
        else:
            role = roles[0]
    else:
        if not roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No demo roles are assigned")
        role = "creator"
        if x_proofline_active_role:
            requested_role = x_proofline_active_role.lower()
            if requested_role not in roles:
                raise HTTPException(status.HTTP_403_FORBIDDEN, "This demo role is not authorized")
            role = requested_role

    return CurrentUser(
        id=user_id,
        email=email,
        role=role,
        account_type=account_type,
        organization_id=identity.get("organization_id"),
        available_roles=roles,
        requires_role_selection=account_type == "judge_demo" or len(roles) > 1,
        global_role=global_role,
    )


class EvaluationUser(BaseModel):
    id: str
    email: str
    allowed_roles: List[str]
    active_role: str = "creator"
    account_type: str = "evaluation"


def get_evaluation_user(
    authorization: Optional[str] = Header(None),
    x_proofline_active_role: Optional[str] = Header(None),
) -> EvaluationUser:
    if not settings.enable_evaluation_access:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evaluation Access is unavailable")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Evaluation sign-in is required")
    token = authorization.split(" ", 1)[1].strip()
    auth_user = _supabase_user(token)
    email = normalize_email(auth_user.get("email", ""))
    user_id = auth_user.get("id")
    if not email or not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Could not verify evaluation identity")

    record = _evaluation_accounts.get(email)
    if not record and settings.supabase_url and settings.supabase_service_role_key:
        url = (
            f"{settings.supabase_url.rstrip('/')}/rest/v1/evaluation_accounts"
            f"?select=id,auth_user_id,normalized_email,is_active,expires_at,"
            f"evaluation_role_assignments(assigned_role)"
            f"&normalized_email=eq.{urllib.parse.quote(email)}"
        )
        req = urllib.request.Request(
            url,
            headers={
                "apikey": settings.supabase_service_role_key,
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                rows = json.loads(response.read().decode("utf-8"))
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError):
            rows = []
        if rows:
            row = rows[0]
            record = {
                "normalized_email": email,
                "roles": sorted({
                    assignment["assigned_role"]
                    for assignment in (row.get("evaluation_role_assignments") or [])
                    if assignment.get("assigned_role") in VALID_ROLES
                }),
                "is_active": bool(row.get("is_active")),
                "expires_at": row.get("expires_at"),
            }

    if not record or not record.get("is_active"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is not authorized for Evaluation Access")
    expires_at = record.get("expires_at")
    if expires_at:
        try:
            from datetime import datetime
            expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if expiry.tzinfo is not None:
                expiry = expiry.astimezone().replace(tzinfo=None)
            if expiry < datetime.utcnow():
                raise HTTPException(status.HTTP_403_FORBIDDEN, "Evaluation Access has expired")
        except HTTPException:
            raise
        except (TypeError, ValueError):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Evaluation account configuration is invalid")
    roles = record["roles"]
    if not roles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No evaluation roles are assigned")
    active_role = "creator"
    if x_proofline_active_role:
        requested = x_proofline_active_role.lower()
        if requested not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This evaluation role is not authorized")
        active_role = requested
    return EvaluationUser(id=user_id, email=email, allowed_roles=roles, active_role=active_role)


def require_evaluation_role(allowed_roles: List[str]):
    def role_checker(current_user: EvaluationUser = Depends(get_evaluation_user)) -> EvaluationUser:
        if current_user.active_role not in allowed_roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This operation is not permitted in the active evaluation role")
        return current_user
    return role_checker


def require_role(allowed_roles: List[str]):
    def role_checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: role '{current_user.role}' is not authorized",
            )
        return current_user
    return role_checker
