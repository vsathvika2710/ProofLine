import uuid
import time
import threading
import logging
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime, timezone
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, status, BackgroundTasks, Request, Header
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import settings
from .models import (
    EvidenceDocument,
    EvidenceChunk,
    StructuredFact,
    ContentAsset,
    Claim,
    ReviewTask,
    AuditLogEntry,
    ChangeImpactResult,
    ClaimType,
    UserRole
)
from .database import db
from .document_parser import extract_text, chunk_document
from .embedding_engine import get_embedding
from .claim_intelligence import claim_engine, ExtractedClaimSchema
from .change_impact_engine import impact_engine
from .seed_data import load_seed_workspace
from .auth import (
    get_current_user,
    require_role,
    CurrentUser,
    EvaluationUser,
    get_evaluation_user,
    require_evaluation_role,
    add_authorized_identity,
    deactivate_authorized_identity,
    add_evaluation_account,
    supabase_password_login,
    supabase_logout,
    _find_authorized_identity,
)
from .guest_verification import (
    GuestAssessmentResponse,
    GuestClaim,
    GuestEvidenceRequest,
    GuestEvidenceResponse,
    GuestProductInfo,
    GuestProductRequest,
    GuestProcessingError,
    GuestTextExtractionRequest,
    assess_guest_claims,
    build_guest_evidence_response,
    extract_guest_image,
    extract_guest_pdf,
    extract_guest_text,
)
from .evaluation_demo_workspace import (
    DEMO_SESSION_TTL_SECONDS,
    evaluation_demo_workspace_store,
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Proofline API",
    description="Evidence-Backed Brand Governance & Change-Impact Engine",
    version="2.0.0"
)

def require_organization_id(user: CurrentUser) -> str:
    if not user.organization_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "An authorized organization is required")
    return user.organization_id

# Direct cross-origin API clients must be explicitly trusted; Vite's local proxy is same-origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auto-seed initial workspace on module load & startup
load_seed_workspace()

@app.on_event("startup")
async def startup_event():
    if not db.list_facts():
        load_seed_workspace()

# ----------------- PUBLIC GUEST VERIFICATION -----------------
GUEST_MAX_FILE_BYTES = 8 * 1024 * 1024
GUEST_REQUESTS_PER_MINUTE = 30
_guest_request_times: Dict[str, List[float]] = {}
_guest_rate_limit_lock = threading.Lock()
OFFICE_LOGIN_ATTEMPTS_PER_MINUTE = 5
_office_login_attempts: Dict[str, List[float]] = {}
_office_login_rate_limit_lock = threading.Lock()


def enforce_guest_rate_limit(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    cutoff = now - 60

    with _guest_rate_limit_lock:
        recent_requests = [
            timestamp
            for timestamp in _guest_request_times.get(client_ip, [])
            if timestamp > cutoff
        ]
        if len(recent_requests) >= GUEST_REQUESTS_PER_MINUTE:
            _guest_request_times[client_ip] = recent_requests
            raise HTTPException(
                status_code=429,
                detail="Guest verification request limit reached. Please wait a minute and try again.",
                headers={"Retry-After": "60"},
            )
        recent_requests.append(now)
        _guest_request_times[client_ip] = recent_requests

        if len(_guest_request_times) > 10_000:
            expired_keys = [
                key
                for key, timestamps in _guest_request_times.items()
                if not timestamps or timestamps[-1] <= cutoff
            ]
            for key in expired_keys:
                _guest_request_times.pop(key, None)


def enforce_office_login_rate_limit(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    cutoff = now - 60
    with _office_login_rate_limit_lock:
        recent = [attempt for attempt in _office_login_attempts.get(client_ip, []) if attempt > cutoff]
        if len(recent) >= OFFICE_LOGIN_ATTEMPTS_PER_MINUTE:
            _office_login_attempts[client_ip] = recent
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many sign-in attempts. Try again later.",
                headers={"Retry-After": "60"},
            )
        recent.append(now)
        _office_login_attempts[client_ip] = recent
        if len(_office_login_attempts) > 10_000:
            for key, attempts in list(_office_login_attempts.items()):
                if not attempts or attempts[-1] <= cutoff:
                    _office_login_attempts.pop(key, None)


DEMO_SESSION_COOKIE = "proofline_evaluation_demo"
MAX_DEMO_ASSETS_PER_SESSION = 100
MAX_DEMO_EVENTS_PER_SESSION = 500


class EvaluationDemoDraftRequest(BaseModel):
    id: Optional[str] = Field(default=None, max_length=80)
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=1_000)
    source_text: str = Field(default="", max_length=20_000)
    input_method: Literal["text", "image", "pdf"] = "text"
    product: GuestProductInfo
    claims: List[GuestClaim] = Field(default_factory=list, max_length=25)
    assessment: Optional[GuestAssessmentResponse] = None


class EvaluationDemoReviewDecision(BaseModel):
    decision: Literal["approve", "reject", "request_revision"]
    note: str = Field(default="", max_length=1_000)
    edited_text: Optional[str] = Field(default=None, max_length=20_000)


def _require_evaluation_demo_session(request: Request) -> Dict[str, Any]:
    if not settings.enable_evaluation_access:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evaluation Access is unavailable")
    session = evaluation_demo_workspace_store.get(request.cookies.get(DEMO_SESSION_COOKIE))
    if session is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Evaluation demo session expired. Reopen Evaluation Access.")
    return session


def _demo_event(
    event_type: str,
    title: str,
    details: str,
    session: Dict[str, Any],
    actor: str = "Evaluation System",
    role: str = "system",
    resource_id: Optional[str] = None,
    version: Optional[int] = None,
) -> Dict[str, Any]:
    return {
        "id": uuid.uuid4().hex,
        "type": event_type,
        "title": title,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "actor": actor,
        "role": role,
        "session_id": session["id"],
        "resource_id": resource_id,
        "version": version,
    }


def _record_demo_event(
    session: Dict[str, Any],
    event_type: str,
    title: str,
    details: str,
    actor: str = "Evaluation System",
    role: str = "system",
    resource_id: Optional[str] = None,
    version: Optional[int] = None,
) -> None:
    session["events"].append(
        _demo_event(event_type, title, details, session, actor, role, resource_id, version)
    )
    del session["events"][:-MAX_DEMO_EVENTS_PER_SESSION]


@app.post(
    "/api/evaluation/demo/session",
    dependencies=[Depends(enforce_guest_rate_limit)],
)
def create_evaluation_demo_session(request: Request, response: Response):
    if not settings.enable_evaluation_access:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evaluation Access is unavailable")

    existing_token = request.cookies.get(DEMO_SESSION_COOKIE)
    existing_session = evaluation_demo_workspace_store.get(existing_token)
    if existing_token and existing_session is not None:
        return {"active": True, "expiresIn": DEMO_SESSION_TTL_SECONDS}

    try:
        token, _ = evaluation_demo_workspace_store.create()
    except RuntimeError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc

    response.set_cookie(
        key=DEMO_SESSION_COOKIE,
        value=token,
        max_age=DEMO_SESSION_TTL_SECONDS,
        httponly=True,
        secure=settings.app_env.strip().lower() not in {"development", "dev", "local"},
        samesite="strict",
        path="/api/evaluation/demo",
    )
    return {"active": True, "expiresIn": DEMO_SESSION_TTL_SECONDS}


@app.get(
    "/api/evaluation/demo/creator/content",
    dependencies=[Depends(enforce_guest_rate_limit)],
)
def list_evaluation_demo_creator_content(
    session: Dict[str, Any] = Depends(_require_evaluation_demo_session),
):
    with evaluation_demo_workspace_store.lock:
        assets = sorted(
            session["assets"].values(),
            key=lambda asset: asset["updated_at"],
            reverse=True,
        )
        return {
            "assets": assets,
            "events": list(reversed(session["events"])),
        }


@app.post(
    "/api/evaluation/demo/creator/content",
    dependencies=[Depends(enforce_guest_rate_limit)],
)
def save_evaluation_demo_creator_content(
    payload: EvaluationDemoDraftRequest,
    session: Dict[str, Any] = Depends(_require_evaluation_demo_session),
):
    if not payload.source_text.strip() and not payload.claims:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Add text or at least one confirmed claim before saving.")

    now = datetime.now(timezone.utc).isoformat()
    with evaluation_demo_workspace_store.lock:
        asset_id = payload.id or f"DEMO-ASSET-{uuid.uuid4().hex[:12]}"
        existing = session["assets"].get(asset_id)
        if existing and existing["approval_status"] not in {"draft", "revision_requested"}:
            raise HTTPException(status.HTTP_409_CONFLICT, "Only drafts or revision-requested content can be edited.")
        if not existing and len(session["assets"]) >= MAX_DEMO_ASSETS_PER_SESSION:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "This demonstration session reached its content limit.")

        product = payload.product.model_dump(mode="json")
        claims = [claim.model_dump(mode="json") for claim in payload.claims]
        assessment = payload.assessment.model_dump(mode="json") if payload.assessment else None
        if existing and (
            existing["title"] == payload.title.strip()
            and existing["description"] == payload.description.strip()
            and existing["source_text"] == payload.source_text
            and existing["input_method"] == payload.input_method
            and existing["product"] == product
            and existing["claims"] == claims
            and existing["assessment"] == assessment
        ):
            return existing

        revision_history = list(existing["revision_history"]) if existing else []
        version = int(existing["version"]) + 1 if existing else 1
        if existing:
            revision_history.append({
                "version": existing["version"],
                "updated_at": existing["updated_at"],
                "author": "Content Creator",
                "source_text": existing["source_text"],
                "assessment": existing["assessment"],
                "approval_status": existing["approval_status"],
            })

        asset = {
            "id": asset_id,
            "title": payload.title.strip(),
            "description": payload.description.strip(),
            "source_text": payload.source_text,
            "input_method": payload.input_method,
            "product": product,
            "claims": claims,
            "assessment": assessment,
            "approval_status": "draft",
            "version": version,
            "created_at": existing["created_at"] if existing else now,
            "updated_at": now,
            "revision_history": revision_history,
        }
        session["assets"][asset_id] = asset
        _record_demo_event(
            session,
            "draft_saved",
            asset["title"],
            f"Saved demonstration draft version {version}.",
            actor="Content Creator",
            role="content_creator",
            resource_id=asset_id,
            version=version,
        )
        return asset


@app.post(
    "/api/evaluation/demo/creator/content/{asset_id}/submit",
    dependencies=[Depends(enforce_guest_rate_limit)],
)
def submit_evaluation_demo_creator_content(
    asset_id: str,
    session: Dict[str, Any] = Depends(_require_evaluation_demo_session),
):
    now = datetime.now(timezone.utc).isoformat()
    with evaluation_demo_workspace_store.lock:
        asset = session["assets"].get(asset_id)
        if asset is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Demonstration content was not found in this session.")
        if asset["approval_status"] not in {"draft", "revision_requested"}:
            raise HTTPException(status.HTTP_409_CONFLICT, "This content is not available for submission.")
        if not asset["assessment"] or not asset["claims"]:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Verify at least one confirmed claim before submitting.")
        try:
            asset["assessment"] = assess_guest_claims(
                GuestProductRequest(
                    name=asset["product"].get("name"),
                    brand=asset["product"].get("brand"),
                ),
                [GuestClaim.model_validate(claim) for claim in asset["claims"]],
                reference_text="",
                input_method=asset["input_method"],
            ).model_dump(mode="json")
        except GuestProcessingError as exc:
            raise HTTPException(exc.status_code, exc.message) from exc

        task_id = f"DEMO-REVIEW-{uuid.uuid4().hex[:12]}"
        task = {
            "id": task_id,
            "assetId": asset["id"],
            "assetTitle": asset["title"],
            "assetType": "website_page",
            "trigger": "content_scan",
            "priority": "high",
            "status": "pending",
            "assignedRole": "legal_compliance",
            "createdAt": now,
            "contentVersion": asset["version"],
            "originalText": asset["source_text"],
            "suggestedText": asset["source_text"],
            "currentText": asset["source_text"],
            "notes": "Fictional NovaWear evaluation content. Evidence is limited to the public demonstration collection.",
            "auditTrail": [{
                "action": "SUBMITTED_FOR_REVIEW",
                "by": "Content Creator",
                "role": "content_creator",
                "timestamp": now,
                "note": f"Submitted demonstration content version {asset['version']}.",
            }],
        }
        asset["approval_status"] = "in_review"
        asset["updated_at"] = now
        asset["review_task_id"] = task_id
        session["reviews"][task_id] = task
        _record_demo_event(
            session,
            "submitted_for_review",
            asset["title"],
            f"Version {asset['version']} was added to the isolated demo Reviewer Queue.",
            actor="Content Creator",
            role="content_creator",
            resource_id=asset["id"],
            version=asset["version"],
        )
        return {"asset": asset, "task": task}


@app.get(
    "/api/evaluation/demo/reviewer/queue",
    dependencies=[Depends(enforce_guest_rate_limit)],
)
def get_evaluation_demo_reviewer_queue(
    session: Dict[str, Any] = Depends(_require_evaluation_demo_session),
):
    with evaluation_demo_workspace_store.lock:
        tasks = sorted(
            session["reviews"].values(),
            key=lambda task: task["createdAt"],
            reverse=True,
        )
        return {"tasks": tasks}


@app.post(
    "/api/evaluation/demo/reviewer/queue/{task_id}/decision",
    dependencies=[Depends(enforce_guest_rate_limit)],
)
def decide_evaluation_demo_review(
    task_id: str,
    payload: EvaluationDemoReviewDecision,
    session: Dict[str, Any] = Depends(_require_evaluation_demo_session),
):
    now = datetime.now(timezone.utc).isoformat()
    with evaluation_demo_workspace_store.lock:
        task = session["reviews"].get(task_id)
        if task is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Review task was not found in this session.")
        if task["status"] != "pending":
            raise HTTPException(status.HTTP_409_CONFLICT, "This review task has already been decided.")

        asset = session["assets"].get(task["assetId"])
        if asset is None:
            raise HTTPException(status.HTTP_409_CONFLICT, "The review task's demonstration content is unavailable.")
        if int(task.get("contentVersion", asset["version"])) != int(asset["version"]):
            raise HTTPException(status.HTTP_409_CONFLICT, "The submitted content version changed. Refresh the review task before deciding.")
        if payload.decision in {"reject", "request_revision"} and not payload.note.strip():
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "A reviewer explanation is required for rejection or revision requests.")

        approved = payload.decision == "approve"
        edited_text = payload.edited_text
        if edited_text is not None and edited_text != asset["source_text"]:
            if approved:
                try:
                    extraction = extract_guest_text(edited_text)
                    reviewed_claims = extraction["claims"]
                    assessment = assess_guest_claims(
                        GuestProductRequest(
                            name=asset["product"].get("name"),
                            brand=asset["product"].get("brand"),
                        ),
                        reviewed_claims,
                        reference_text="",
                        input_method="text",
                    )
                except GuestProcessingError as exc:
                    raise HTTPException(exc.status_code, exc.message) from exc
                if any(finding.status == "contradicted" for finding in assessment.findings):
                    raise HTTPException(status.HTTP_409_CONFLICT, "Content with contradicted claims cannot be approved.")
                next_claims = [claim.model_dump(mode="json") for claim in reviewed_claims]
                next_assessment = assessment.model_dump(mode="json")
            else:
                next_claims = []
                next_assessment = None

            previous_version = {
                "version": asset["version"],
                "updated_at": asset["updated_at"],
                "author": "Content Creator",
                "source_text": asset["source_text"],
                "assessment": asset["assessment"],
                "approval_status": asset["approval_status"],
            }
            asset["revision_history"].append(previous_version)
            asset["version"] = int(asset["version"]) + 1
            asset["source_text"] = edited_text
            asset["claims"] = next_claims
            asset["assessment"] = next_assessment
            asset["input_method"] = "text"
            asset["updated_at"] = now
        elif approved and any(
            finding.get("status") == "contradicted"
            for finding in (asset.get("assessment") or {}).get("findings", [])
        ):
            raise HTTPException(status.HTTP_409_CONFLICT, "Content with contradicted claims cannot be approved.")

        task["status"] = "approved" if approved else ("rejected" if payload.decision == "reject" else "modified")
        task["reviewedBy"] = "Evaluation Reviewer"
        task["reviewedAt"] = now
        if edited_text is not None:
            task["currentText"] = edited_text
        task["notes"] = payload.note.strip() or "Approved in the demonstration workspace."
        task["auditTrail"].append({
            "action": "APPROVED" if approved else ("REJECTED" if payload.decision == "reject" else "REVISION_REQUESTED"),
            "by": "Evaluation Reviewer",
            "role": "agency_reviewer",
            "timestamp": now,
            "note": task["notes"],
        })
        asset["approval_status"] = "approved" if approved else ("rejected" if payload.decision == "reject" else "revision_requested")
        asset["updated_at"] = now
        _record_demo_event(
            session,
            "review_approved" if approved else ("review_rejected" if payload.decision == "reject" else "revision_requested"),
            asset["title"],
            task["notes"],
            actor="Evaluation Reviewer",
            role="reviewer",
            resource_id=asset["id"],
            version=asset["version"],
        )
        return {"asset": asset, "task": task}


def _guest_file_error(status_code: int, message: str):
    raise HTTPException(status_code=status_code, detail=message)


@app.post(
    "/api/guest/extract/text",
    dependencies=[Depends(enforce_guest_rate_limit)],
)
def guest_extract_text(payload: GuestTextExtractionRequest):
    try:
        return extract_guest_text(payload.text)
    except GuestProcessingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@app.post(
    "/api/guest/extract/file",
    dependencies=[Depends(enforce_guest_rate_limit)],
)
async def guest_extract_file(request: Request, file: UploadFile = File(...)):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > GUEST_MAX_FILE_BYTES + 512 * 1024:
                _guest_file_error(413, "Upload exceeds the 8 MB file-size limit.")
        except ValueError:
            _guest_file_error(400, "Invalid Content-Length header.")

    filename = (file.filename or "").rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    extension = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    allowed_extensions = {"pdf", "jpg", "jpeg", "png", "webp"}
    if extension not in allowed_extensions:
        _guest_file_error(415, "Choose a JPG, JPEG, PNG, WEBP image or PDF file.")

    try:
        file_bytes = await file.read(GUEST_MAX_FILE_BYTES + 1)
    finally:
        await file.close()

    if not file_bytes:
        _guest_file_error(400, "The selected file is empty.")
    if len(file_bytes) > GUEST_MAX_FILE_BYTES:
        _guest_file_error(413, "Upload exceeds the 8 MB file-size limit.")

    if extension == "pdf":
        if not file_bytes.startswith(b"%PDF-"):
            _guest_file_error(415, "The uploaded file does not appear to be a valid PDF.")
        try:
            extracted_text = extract_guest_pdf(file_bytes)
            result = extract_guest_text(extracted_text)
        except GuestProcessingError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
        result["input_method"] = "pdf"
        result["extraction_notice"] = (
            "Text was extracted from the uploaded PDF using PyMuPDF and analyzed with deterministic local rules. "
            "Scanned/image-only pages are not OCR-processed. Review the extracted information."
        )
        return result

    expected_mime = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
    }[extension]
    content_type = (file.content_type or "").lower()
    if content_type not in {"", "application/octet-stream", expected_mime}:
        _guest_file_error(415, "The file type does not match the selected image format.")

    image_signatures = {
        "jpg": file_bytes.startswith(b"\xff\xd8\xff"),
        "jpeg": file_bytes.startswith(b"\xff\xd8\xff"),
        "png": file_bytes.startswith(b"\x89PNG\r\n\x1a\n"),
        "webp": len(file_bytes) >= 12 and file_bytes[:4] == b"RIFF" and file_bytes[8:12] == b"WEBP",
    }
    if not image_signatures[extension]:
        _guest_file_error(415, "The uploaded file is not a valid image of the selected type.")

    try:
        return extract_guest_image(file_bytes, expected_mime)
    except GuestProcessingError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@app.post(
    "/api/guest/evidence",
    response_model=GuestEvidenceResponse,
    dependencies=[Depends(enforce_guest_rate_limit)],
)
def guest_find_evidence(payload: GuestEvidenceRequest):
    return build_guest_evidence_response(
        product=payload.product,
        claims=payload.claims,
        reference_text=payload.reference_text,
    )


@app.post(
    "/api/guest/assess",
    response_model=GuestAssessmentResponse,
    dependencies=[Depends(enforce_guest_rate_limit)],
)
def guest_assess_claims(payload: GuestEvidenceRequest):
    return assess_guest_claims(
        product=payload.product,
        claims=payload.claims,
        reference_text=payload.reference_text,
        input_method=payload.input_method,
    )

# ----------------- 1. HEALTH & METRICS -----------------
@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "Proofline Governance Engine",
        "version": settings.version,
        "environment": settings.app_env,
        "ai_engine": settings.gemini_model if settings.has_gemini_key else "Deterministic Grounded Mock",
        "disclosure_notice": settings.ai_service_disclosure
    }

@app.get("/api/dashboard/stats")
def get_dashboard_stats(user: CurrentUser = Depends(get_current_user)):
    organization_id = require_organization_id(user)
    assets = db.list_assets(organization_id)
    claims = db.list_claims(organization_id)
    tasks = db.list_tasks(organization_id=organization_id)
    facts = db.list_facts(organization_id)
    impact_events = [
        event for event in db.impact_events
        if event.get("organization_id") == organization_id
    ]

    flagged_claims = [c for c in claims if c.verification_status in ['contradicted', 'outdated', 'unsupported', 'needs_human_review']]
    open_reviews = [t for t in tasks if t.status == 'pending']

    # Calculate Brand Health Index
    supported_claims = [c for c in claims if c.verification_status == 'supported']
    total_claims_count = max(len(claims), 1)
    health_score = round((len(supported_claims) / total_claims_count) * 100)

    return {
        "total_assets": len(assets),
        "total_claims": len(claims),
        "flagged_claims": len(flagged_claims),
        "open_reviews": len(open_reviews),
        "total_facts": len(facts),
        "facts_changed": len(impact_events),
        "brand_health_score": health_score,
        "breakdown": {
            "supported": len(supported_claims),
            "outdated": len([c for c in claims if c.verification_status == 'outdated']),
            "contradicted": len([c for c in claims if c.verification_status == 'contradicted']),
            "unsupported": len([c for c in claims if c.verification_status == 'unsupported']),
            "needs_review": len([c for c in claims if c.verification_status == 'needs_human_review']),
        }
    }

# ----------------- 2. AUTHENTICATION & ROLES -----------------
class RoleSwitchRequest(BaseModel):
    role: str


class WorkspaceAuthorizationResponse(BaseModel):
    accountType: str
    globalRole: str = "employee"
    organizationId: Optional[str] = None
    assignedRole: Optional[str] = None
    availableRoles: List[str]
    requiresRoleSelection: bool

class AuthorizedIdentityRequest(BaseModel):
    email: str
    account_type: str
    organization_id: Optional[str] = None
    roles: List[str]
    is_active: bool = True


class OfficeLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=1024)


@app.post("/api/auth/login", dependencies=[Depends(enforce_office_login_rate_limit)])
def office_password_login(payload: OfficeLoginRequest):
    try:
        provider_session = supabase_password_login(payload.email, payload.password)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_401_UNAUTHORIZED:
            logger.info("Office login rejected by Supabase Auth")
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password") from exc
        raise

    logger.info("Supabase password authentication succeeded; checking Office authorization")
    email = str((provider_session.get("user") or {}).get("email") or payload.email).strip().lower()
    identity = _find_authorized_identity(email)
    if not identity or not identity.get("is_active") or identity.get("account_type") != "employee":
        logger.warning("Authenticated Supabase user is not an active Office identity")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    logger.info(
        "Office authorization accepted (global_role=%s, workspace_count=%s)",
        identity.get("global_role", "employee"),
        len(identity.get("roles") or []),
    )

    return {
        "access_token": provider_session["access_token"],
        "refresh_token": provider_session["refresh_token"],
        "expires_in": provider_session.get("expires_in"),
        "token_type": provider_session.get("token_type", "bearer"),
        "user": {
            "id": (provider_session.get("user") or {}).get("id"),
            "email": email,
        },
    }


@app.post("/api/auth/logout")
def office_logout(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in is required")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in is required")
    supabase_logout(token)
    return {"success": True}

@app.get("/api/auth/workspace", response_model=WorkspaceAuthorizationResponse)
def resolve_workspace(user: CurrentUser = Depends(get_current_user)):
    if user.account_type == "judge_demo":
        if not user.organization_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "The demo organization is not configured")
        return {
            "accountType": "judge_demo",
            "globalRole": "judge_demo",
            "organizationId": user.organization_id,
            "assignedRole": None,
            "availableRoles": user.available_roles,
            "requiresRoleSelection": True,
        }
    if user.global_role == "super_admin":
        return {
            "accountType": "super_admin",
            "globalRole": "super_admin",
            "organizationId": user.organization_id,
            "assignedRole": user.role,
            "availableRoles": user.available_roles,
            "requiresRoleSelection": True,
        }
    return {
        "accountType": "employee",
        "globalRole": user.global_role,
        "organizationId": user.organization_id,
        "assignedRole": user.role,
        "availableRoles": user.available_roles,
        "requiresRoleSelection": user.requires_role_selection,
    }

@app.post("/api/auth/workspace/select-role")
def switch_authorized_workspace(payload: RoleSwitchRequest, user: CurrentUser = Depends(get_current_user)):
    if not user.requires_role_selection:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has only one authorized workspace")
    if payload.role not in user.available_roles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This workspace is not authorized")
    return {
        "success": True,
        "activeRole": payload.role,
        "organizationId": user.organization_id,
    }

@app.get("/api/config/features")
def get_feature_flags():
    return {"enableEvaluationAccess": settings.enable_evaluation_access}

class EvaluationWorkspaceResponse(BaseModel):
    accountType: str = "evaluation"
    organizationId: str = "novaweare-demo-org"
    allowedRoles: List[str]

@app.get("/api/evaluation/workspace", response_model=EvaluationWorkspaceResponse)
def resolve_evaluation_workspace(user: EvaluationUser = Depends(get_evaluation_user)):
    return {
        "accountType": "evaluation",
        "organizationId": "novaweare-demo-org",
        "allowedRoles": user.allowed_roles,
    }

@app.post("/api/evaluation/select-role")
def select_evaluation_role(payload: RoleSwitchRequest, user: EvaluationUser = Depends(get_evaluation_user)):
    if payload.role not in user.allowed_roles:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This evaluation role is not authorized")
    return {"success": True, "activeRole": payload.role, "organizationId": "novaweare-demo-org"}

class EvaluationAccountRequest(BaseModel):
    email: str
    roles: List[str]
    is_active: bool = True
    expires_at: Optional[str] = None

@app.post("/api/admin/evaluation-accounts")
def provision_evaluation_account(
    payload: EvaluationAccountRequest,
    user: CurrentUser = Depends(require_role(["admin"])),
):
    if user.account_type != "employee":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an employee administrator can provision evaluation access")
    try:
        record = add_evaluation_account(payload.email, payload.roles, payload.is_active, payload.expires_at)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    db.record_audit(
        actor=user.email,
        role=user.role,
        action="EVALUATION_ACCOUNT_UPDATED",
        target_entity="evaluation_accounts",
        notes=f"Updated evaluation account {record['normalized_email']}",
    )
    record.pop("normalized_email")
    return record

@app.get("/api/auth/me")
def get_current_user_info(user: CurrentUser = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "accountType": user.account_type,
        "globalRole": user.global_role,
        "organizationId": user.organization_id,
        "availableRoles": user.available_roles,
        "requiresRoleSelection": user.requires_role_selection,
        "can_approve": user.role in ["admin", "reviewer"],
    }

@app.post("/api/admin/authorized-identities")
def add_authorized_account(
    payload: AuthorizedIdentityRequest,
    user: CurrentUser = Depends(require_role(["admin"])),
):
    if user.account_type == "judge_demo":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Judge demo accounts cannot manage authorization")
    try:
        record = add_authorized_identity(
            payload.email,
            payload.account_type,
            payload.organization_id,
            payload.roles,
            payload.is_active,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    db.record_audit(
        actor=user.email,
        role=user.role,
        action="AUTHORIZED_IDENTITY_UPDATED",
        target_entity="authorized_identities",
        notes=f"Updated authorized identity {record['normalized_email']}",
    )
    record.pop("normalized_email")
    return record

# ----------------- 3. EVIDENCE VAULT -----------------
@app.get("/api/evidence", response_model=List[EvidenceDocument])
def list_evidence_documents(user: CurrentUser = Depends(get_current_user)):
    return db.list_documents(require_organization_id(user))

@app.post("/api/evidence/upload")
async def upload_evidence_document(
    title: str = Form(...),
    doc_type: str = Form("pdf"),
    owner: str = Form("Legal & Compliance"),
    version: str = Form("v1.0"),
    effective_date: str = Form(datetime.utcnow().strftime("%Y-%m-%d")),
    expiry_date: Optional[str] = Form(None),
    raw_text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    user: CurrentUser = Depends(require_role(["admin"]))
):
    organization_id = require_organization_id(user)
    text_content = raw_text or ""
    filename = file.filename if file else f"{title}.{doc_type}"

    if file:
        file_bytes = await file.read()
        extracted = extract_text(file_bytes, filename)
        if extracted:
            text_content = extracted

    if not text_content.strip():
        raise HTTPException(status_code=400, detail="Document content cannot be empty.")

    doc_id = f"DOC-{uuid.uuid4().hex[:6].upper()}"
    doc = EvidenceDocument(
        id=doc_id,
        title=title,
        doc_type=doc_type if doc_type in ['pdf', 'docx', 'txt'] else 'pdf',
        owner=owner,
        version=version,
        approval_status="approved",
        effective_date=effective_date,
        expiry_date=expiry_date,
        raw_text=text_content,
        created_at=datetime.utcnow().isoformat() + "Z",
        organization_id=organization_id,
    )

    db.add_document(doc)

    # Chunk and embed document
    raw_chunks = chunk_document(text_content)
    chunk_objs = []
    for idx, sec_title, passage in raw_chunks:
        chunk_obj = EvidenceChunk(
            id=f"CHK-{uuid.uuid4().hex[:8].upper()}",
            document_id=doc.id,
            document_title=doc.title,
            chunk_index=idx,
            passage_text=passage,
            section_title=sec_title,
            embedding=get_embedding(passage),
            metadata={"owner": owner, "version": version},
            organization_id=organization_id,
        )
        chunk_objs.append(chunk_obj)
    db.add_chunks(chunk_objs)
    doc.chunk_count = len(chunk_objs)

    db.record_audit(
        actor=user.email,
        role=user.role,
        action="DOCUMENT_UPLOADED",
        target_entity="evidence_documents",
        target_id=doc.id,
        diff_payload={"title": title, "version": version, "chunks": len(chunk_objs)},
        notes=f"Uploaded and indexed '{title}' into Evidence Vault.",
        organization_id=organization_id,
    )
    return doc

# ----------------- 4. STRUCTURED FACTS -----------------
@app.get("/api/facts", response_model=List[StructuredFact])
def list_structured_facts(user: CurrentUser = Depends(get_current_user)):
    return db.list_facts(require_organization_id(user))

class CreateFactRequest(BaseModel):
    fact_key: str
    name: str
    current_value: str
    unit: Optional[str] = None
    source_document_id: Optional[str] = None
    source_passage: str
    version: str = "v1.0"

@app.post("/api/facts")
def create_structured_fact(
    payload: CreateFactRequest,
    user: CurrentUser = Depends(require_role(["admin", "reviewer"]))
):
    organization_id = require_organization_id(user)
    doc_title = None
    if payload.source_document_id:
        doc = db.get_document(payload.source_document_id, organization_id)
        if doc:
            doc_title = doc.title

    fact = StructuredFact(
        id=f"FACT-{uuid.uuid4().hex[:6].upper()}",
        fact_key=payload.fact_key,
        name=payload.name,
        current_value=payload.current_value,
        unit=payload.unit,
        source_document_id=payload.source_document_id,
        source_document_title=doc_title,
        source_passage=payload.source_passage,
        version=payload.version,
        updated_at=datetime.utcnow().isoformat() + "Z",
        organization_id=organization_id,
    )
    db.add_or_update_fact(fact)
    return fact

# ----------------- 5. CONTENT ASSETS & CLAIM SCAN -----------------
@app.get("/api/content", response_model=List[ContentAsset])
def list_content_assets(user: CurrentUser = Depends(get_current_user)):
    return db.list_assets(require_organization_id(user))

class CreateAssetRequest(BaseModel):
    title: str
    asset_type: str = "website_page"
    channel: str = "Web"
    raw_text: str

@app.post("/api/content")
def create_content_asset(
    payload: CreateAssetRequest,
    user: CurrentUser = Depends(require_role(["creator", "admin"]))
):
    organization_id = require_organization_id(user)
    asset_id = f"AST-{uuid.uuid4().hex[:6].upper()}"
    asset = ContentAsset(
        id=asset_id,
        title=payload.title,
        asset_type=payload.asset_type if payload.asset_type in ['website_page', 'sales_brochure', 'instagram_post', 'email_newsletter', 'support_faq'] else 'website_page',
        channel=payload.channel,
        raw_text=payload.raw_text,
        approval_status="draft",
        created_at=datetime.utcnow().isoformat() + "Z",
        organization_id=organization_id,
        created_by=user.id,
    )
    db.add_or_update_asset(asset)

    # Automatically extract claims and verify
    extracted = claim_engine.extract_claims(payload.raw_text)
    verified_claims = []
    issues_count = 0
    for ext in extracted:
        v_claim = claim_engine.match_and_verify_claim(ext, asset.id, organization_id)
        db.add_claim(v_claim)
        verified_claims.append(v_claim)
        if v_claim.verification_status != "supported":
            issues_count += 1

    asset.claims_count = len(verified_claims)
    asset.issues_count = issues_count
    asset.last_scanned_at = datetime.utcnow().isoformat() + "Z"
    db.add_or_update_asset(asset)

    return asset

@app.post("/api/content/{asset_id}/submit")
def submit_content_asset(asset_id: str, user: CurrentUser = Depends(require_role(["creator"]))):
    organization_id = require_organization_id(user)
    asset = db.get_asset(asset_id, organization_id)
    if not asset:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content asset not found")
    if asset.approval_status not in {"draft", "revision_requested"}:
        raise HTTPException(status.HTTP_409_CONFLICT, "This content is not available for submission")

    existing = next(
        (
            task for task in db.list_tasks(organization_id=organization_id)
            if task.asset_id == asset.id and task.status == "pending"
        ),
        None,
    )
    if existing:
        return {"asset": asset, "task": existing}

    claims = db.get_claims_by_asset(asset.id, organization_id)
    corrections = [claim.suggested_correction for claim in claims if claim.suggested_correction]
    citations = [
        f"{claim.source_document_title}: {claim.quoted_passage}"
        for claim in claims
        if claim.source_document_title and claim.quoted_passage
    ]
    task = ReviewTask(
        id=f"TSK-{uuid.uuid4().hex[:8].upper()}",
        asset_id=asset.id,
        asset_title=asset.title,
        asset_type=asset.asset_type,
        claim_id=claims[0].id if claims else None,
        trigger_type="content_scan",
        priority="high",
        assigned_role="reviewer",
        original_text=asset.raw_text,
        suggested_text="\n".join(corrections),
        explanation=(
            f"{len(claims)} claim(s) were extracted; "
            f"{sum(claim.verification_status != 'supported' for claim in claims)} require reviewer attention."
        ),
        cited_source="\n".join(citations),
        status="pending",
        created_at=datetime.utcnow().isoformat() + "Z",
        organization_id=organization_id,
        content_version=asset.version,
    )
    db.add_task(task)
    asset.approval_status = "under_review"
    db.add_or_update_asset(asset)
    db.record_audit(
        actor=user.email,
        role=user.role,
        action="CONTENT_SUBMITTED",
        target_entity="content_assets",
        target_id=asset.id,
        diff_payload={"version": asset.version, "review_task_id": task.id},
        notes="Content submitted for organization-scoped human review.",
        organization_id=organization_id,
    )
    return {"asset": asset, "task": task}

@app.get("/api/content/{asset_id}")
def get_content_asset(asset_id: str, user: CurrentUser = Depends(get_current_user)):
    asset = db.get_asset(asset_id, require_organization_id(user))
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    claims = db.get_claims_by_asset(asset_id, require_organization_id(user))
    return {
        "asset": asset,
        "claims": claims
    }

class UpdateContentAssetRequest(BaseModel):
    title: str
    asset_type: str = "website_page"
    channel: str = "Web"
    raw_text: str


@app.put("/api/content/{asset_id}")
def update_content_asset(
    asset_id: str,
    payload: UpdateContentAssetRequest,
    user: CurrentUser = Depends(require_role(["creator", "admin"])),
):
    organization_id = require_organization_id(user)
    asset = db.get_asset(asset_id, organization_id)
    if not asset:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Content asset not found")
    if user.role != "admin" and asset.created_by != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the submitting creator or an admin may update this content")
    if asset.approval_status not in {"draft", "revision_requested", "rejected"}:
        raise HTTPException(status.HTTP_409_CONFLICT, "Content cannot be edited in its current review state")
    if not payload.raw_text.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Content text cannot be empty")

    asset.revision_history.append({
        "version": asset.version,
        "updated_at": datetime.utcnow().isoformat() + "Z",
        "author": user.email,
        "source_text": asset.raw_text,
        "approval_status": asset.approval_status,
    })
    asset.version += 1
    asset.title = payload.title.strip()
    asset.asset_type = payload.asset_type if payload.asset_type in {
        "website_page", "sales_brochure", "instagram_post", "email_newsletter", "support_faq"
    } else "website_page"
    asset.channel = payload.channel
    asset.raw_text = payload.raw_text
    asset.approval_status = "draft"

    db.delete_claims_by_asset(asset.id, organization_id)
    extracted = claim_engine.extract_claims(asset.raw_text)
    claims = [
        claim_engine.match_and_verify_claim(item, asset.id, organization_id)
        for item in extracted
    ]
    for claim in claims:
        db.add_claim(claim)
    asset.claims_count = len(claims)
    asset.issues_count = sum(claim.verification_status != "supported" for claim in claims)
    db.add_or_update_asset(asset)
    db.record_audit(
        actor=user.email,
        role=user.role,
        action="CONTENT_REVISED",
        target_entity="content_assets",
        target_id=asset.id,
        diff_payload={"version": asset.version},
        notes="Creator revised content after review.",
        organization_id=organization_id,
    )
    return {"asset": asset, "claims": claims}


def _organization_asset_records(organization_id: str) -> List[Dict[str, Any]]:
    return [
        {
            **asset.dict(),
            "claims": [claim.dict() for claim in db.get_claims_by_asset(asset.id, organization_id)],
        }
        for asset in db.list_assets(organization_id)
    ]


@app.get("/api/creator/workspace")
def get_creator_workspace(user: CurrentUser = Depends(require_role(["creator", "admin"]))):
    organization_id = require_organization_id(user)
    return {
        "assets": _organization_asset_records(organization_id),
        "events": [entry.dict() for entry in db.list_audit_logs(limit=100, organization_id=organization_id)],
    }


@app.get("/api/reviewer/workspace")
def get_reviewer_workspace(user: CurrentUser = Depends(require_role(["reviewer", "admin"]))):
    organization_id = require_organization_id(user)
    return {
        "assets": _organization_asset_records(organization_id),
        "tasks": [task.dict() for task in db.list_tasks(organization_id=organization_id)],
        "events": [entry.dict() for entry in db.list_audit_logs(limit=200, organization_id=organization_id)],
        "impact_events": [
            event for event in db.impact_events
            if event.get("organization_id") == organization_id
        ],
        "facts": [fact.dict() for fact in db.list_facts(organization_id)],
        "fact_history": db.list_fact_history(organization_id),
    }

class ScanTextRequest(BaseModel):
    text: str
    asset_type: Optional[str] = "marketing_copy"

@app.post("/api/claims/scan-text")
def scan_text(
    payload: ScanTextRequest,
    user: CurrentUser = Depends(require_role(["creator", "admin", "reviewer"]))
):
    organization_id = require_organization_id(user)
    extracted = claim_engine.extract_claims(payload.text)
    results = []
    temp_asset_id = "TEMP-SCAN"
    for item in extracted:
        verified = claim_engine.match_and_verify_claim(item, temp_asset_id, organization_id)
        results.append(verified)
    return {
        "claims_found": len(results),
        "claims": results,
        "ai_notice": settings.ai_service_disclosure
    }

# ----------------- 6. SIGNATURE: CHANGE IMPACT ENGINE -----------------
class FactChangeRequest(BaseModel):
    fact_id: str
    new_value: str

@app.post("/api/impact/change-fact", response_model=ChangeImpactResult)
def trigger_fact_change_impact(
    payload: FactChangeRequest,
    user: CurrentUser = Depends(require_role(["admin"]))
):
    """
    Signature Engine: Edits an approved fact (e.g. Warranty 2 years -> 1 year).
    System walks the dependency graph, runs exact-value comparisons first + grounded check second,
    invalidates approval on affected assets, marks unrelated claims as 'checked, not affected',
    and auto-creates review tasks.
    """
    try:
        result = impact_engine.execute_fact_change(
            fact_id=payload.fact_id,
            new_value=payload.new_value,
            actor=user.email,
            actor_role=user.role,
            organization_id=require_organization_id(user),
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/api/impact/events")
def get_impact_events(user: CurrentUser = Depends(require_role(["admin", "reviewer"]))):
    organization_id = require_organization_id(user)
    return [
        event for event in db.impact_events
        if event.get("organization_id") == organization_id
    ]

# ----------------- 7. HUMAN REVIEW CENTRE & RBAC -----------------
@app.get("/api/reviews", response_model=List[ReviewTask])
def list_review_tasks(
    status: Optional[str] = None,
    role: Optional[str] = None,
    user: CurrentUser = Depends(require_role(["reviewer", "admin"]))
):
    return db.list_tasks(status=status, role=role, organization_id=require_organization_id(user))

class TaskDecisionRequest(BaseModel):
    decision: str  # 'approve', 'reject', 'edit'
    edited_text: Optional[str] = None
    notes: Optional[str] = None

@app.post("/api/reviews/{task_id}/decision")
def make_review_decision(
    task_id: str,
    payload: TaskDecisionRequest,
    user: CurrentUser = Depends(require_role(["reviewer", "admin"]))
):
    """
    Applies Human Review decision.
    RBAC enforced: Only authorized reviewers/admins can approve/reject.
    AI suggests; humans decide.
    """
    if user.role not in ["reviewer", "admin", "legal_compliance"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Role '{user.role}' cannot approve reviews. Only reviewers and admins are authorized."
        )

    organization_id = require_organization_id(user)
    task = db.get_task(task_id, organization_id)
    if not task:
        raise HTTPException(status_code=404, detail="Review task not found")

    decision = payload.decision.lower()
    if decision not in ['approve', 'reject', 'edit', 'request_revision']:
        raise HTTPException(status_code=400, detail="Decision must be 'approve', 'reject', 'edit', or 'request_revision'.")
    if task.status != "pending":
        raise HTTPException(status_code=409, detail="This review decision has already been recorded.")
    if decision in {"reject", "request_revision"} and not (payload.notes or "").strip():
        raise HTTPException(status_code=400, detail="A reviewer note is required for this decision.")

    task.status = "approved" if decision == "approve" else ("rejected" if decision == "reject" else "edited")
    task.decision_notes = payload.notes
    task.decided_by = user.email
    task.decided_at = datetime.utcnow().isoformat() + "Z"
    task.decision_history.append({
        "decision": decision,
        "status": task.status,
        "reviewer": user.email,
        "role": user.role,
        "notes": payload.notes,
        "content_version": task.content_version,
        "decided_at": task.decided_at,
    })

    asset = db.get_asset(task.asset_id, organization_id)
    if asset:
        if decision == "approve":
            asset.approval_history.append({
                "version": asset.version,
                "approved_by": user.email,
                "approved_at": task.decided_at,
                "review_task_id": task.id,
            })
            asset.approval_status = "approved"
            asset.last_approved_by = user.email
            asset.last_approved_at = task.decided_at
            db.add_or_update_asset(asset)
        elif decision == "reject":
            asset.approval_status = "rejected"
            db.add_or_update_asset(asset)
        elif decision == "request_revision":
            asset.approval_status = "revision_requested"
            db.add_or_update_asset(asset)
        elif decision == "edit":
            replacement_text = payload.edited_text if decision == 'edit' and payload.edited_text else task.suggested_text
            asset.raw_text = asset.raw_text.replace(task.original_text, replacement_text)
            asset.approval_status = "approved"
            asset.last_approved_by = user.email
            asset.last_approved_at = datetime.utcnow().isoformat() + "Z"
            asset.issues_count = max(0, asset.issues_count - 1)
            asset.version += 1
            asset.approval_history.append({
                "version": asset.version,
                "approved_by": user.email,
                "approved_at": asset.last_approved_at,
                "review_task_id": task.id,
            })
            db.add_or_update_asset(asset)

    db.add_task(task)
    db.record_audit(
        actor=user.email,
        role=user.role,
        action=f"REVIEW_{decision.upper()}",
        target_entity="review_tasks",
        target_id=task.id,
        diff_payload={"decision": decision, "content_version": task.content_version},
        notes=payload.notes or f"Human reviewer recorded {decision}.",
        organization_id=organization_id,
    )

    return {
        "success": True,
        "task": task,
        "asset": asset
    }

# ----------------- 8. AUDIT LOG & REPOSITORY -----------------
@app.get("/api/audit", response_model=List[AuditLogEntry])
def get_audit_trail(
    limit: int = 50,
    user: CurrentUser = Depends(require_role(["admin"]))
):
    return db.list_audit_logs(limit=limit, organization_id=require_organization_id(user))

# ----------------- 9. DEMO WORKSPACE & EVALUATION -----------------
@app.post("/api/workspace/load-demo")
def load_demo(user: CurrentUser = Depends(require_role(["admin"]))):
    load_seed_workspace()
    return {"message": "NovaWear SmartWatch X demo workspace loaded successfully."}

@app.post("/api/eval/run")
def run_evaluation_suite(user: CurrentUser = Depends(require_role(["admin"]))):
    from .eval_runner import evaluate_test_set
    results = evaluate_test_set()
    return results
