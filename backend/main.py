import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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
from .auth import get_current_user, require_role, CurrentUser

app = FastAPI(
    title="Proofline API",
    description="Evidence-Backed Brand Governance & Change-Impact Engine",
    version="2.0.0"
)

# CORS middleware for Next.js / Vite local development and deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
def get_dashboard_stats():
    assets = db.list_assets()
    claims = db.list_claims()
    tasks = db.list_tasks()
    facts = db.list_facts()
    impact_events = db.impact_events

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
    role: UserRole

@app.get("/api/auth/me")
def get_current_user_info(user: CurrentUser = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "can_approve": user.role in ["admin", "reviewer", "legal_compliance"]
    }

# ----------------- 3. EVIDENCE VAULT -----------------
@app.get("/api/evidence", response_model=List[EvidenceDocument])
def list_evidence_documents():
    return db.list_documents()

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
    user: CurrentUser = Depends(get_current_user)
):
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
        created_at=datetime.utcnow().isoformat() + "Z"
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
            metadata={"owner": owner, "version": version}
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
        notes=f"Uploaded and indexed '{title}' into Evidence Vault."
    )
    return doc

# ----------------- 4. STRUCTURED FACTS -----------------
@app.get("/api/facts", response_model=List[StructuredFact])
def list_structured_facts():
    return db.list_facts()

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
    doc_title = None
    if payload.source_document_id:
        doc = db.get_document(payload.source_document_id)
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
        updated_at=datetime.utcnow().isoformat() + "Z"
    )
    db.add_or_update_fact(fact)
    return fact

# ----------------- 5. CONTENT ASSETS & CLAIM SCAN -----------------
@app.get("/api/content", response_model=List[ContentAsset])
def list_content_assets():
    return db.list_assets()

class CreateAssetRequest(BaseModel):
    title: str
    asset_type: str = "website_page"
    channel: str = "Web"
    raw_text: str

@app.post("/api/content")
def create_content_asset(
    payload: CreateAssetRequest,
    user: CurrentUser = Depends(get_current_user)
):
    asset_id = f"AST-{uuid.uuid4().hex[:6].upper()}"
    asset = ContentAsset(
        id=asset_id,
        title=payload.title,
        asset_type=payload.asset_type if payload.asset_type in ['website_page', 'sales_brochure', 'instagram_post', 'email_newsletter', 'support_faq'] else 'website_page',
        channel=payload.channel,
        raw_text=payload.raw_text,
        approval_status="draft",
        created_at=datetime.utcnow().isoformat() + "Z"
    )
    db.add_or_update_asset(asset)

    # Automatically extract claims and verify
    extracted = claim_engine.extract_claims(payload.raw_text)
    verified_claims = []
    issues_count = 0
    for ext in extracted:
        v_claim = claim_engine.match_and_verify_claim(ext, asset.id)
        db.add_claim(v_claim)
        verified_claims.append(v_claim)
        if v_claim.verification_status != "supported":
            issues_count += 1

    asset.claims_count = len(verified_claims)
    asset.issues_count = issues_count
    asset.last_scanned_at = datetime.utcnow().isoformat() + "Z"
    db.add_or_update_asset(asset)

    return asset

@app.get("/api/content/{asset_id}")
def get_content_asset(asset_id: str):
    asset = db.get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    claims = db.get_claims_by_asset(asset_id)
    return {
        "asset": asset,
        "claims": claims
    }

class ScanTextRequest(BaseModel):
    text: str
    asset_type: Optional[str] = "marketing_copy"

@app.post("/api/claims/scan-text")
def scan_text(payload: ScanTextRequest):
    extracted = claim_engine.extract_claims(payload.text)
    results = []
    temp_asset_id = "TEMP-SCAN"
    for item in extracted:
        verified = claim_engine.match_and_verify_claim(item, temp_asset_id)
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
    user: CurrentUser = Depends(get_current_user)
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
            actor_role=user.role
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/api/impact/events")
def get_impact_events():
    return db.impact_events

# ----------------- 7. HUMAN REVIEW CENTRE & RBAC -----------------
@app.get("/api/reviews", response_model=List[ReviewTask])
def list_review_tasks(
    status: Optional[str] = None,
    role: Optional[str] = None
):
    return db.list_tasks(status=status, role=role)

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

    task = db.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Review task not found")

    decision = payload.decision.lower()
    if decision not in ['approve', 'reject', 'edit']:
        raise HTTPException(status_code=400, detail="Decision must be 'approve', 'reject', or 'edit'.")

    task.status = "approved" if decision == "approve" else ("rejected" if decision == "reject" else "edited")
    task.decision_notes = payload.notes
    task.decided_by = user.email
    task.decided_at = datetime.utcnow().isoformat() + "Z"

    asset = db.get_asset(task.asset_id)
    if asset:
        if decision in ['approve', 'edit']:
            # Apply human-approved correction to content text
            replacement_text = payload.edited_text if decision == 'edit' and payload.edited_text else task.suggested_text
            asset.raw_text = asset.raw_text.replace(task.original_text, replacement_text)
            asset.approval_status = "approved"
            asset.last_approved_by = user.email
            asset.last_approved_at = datetime.utcnow().isoformat() + "Z"
            asset.issues_count = max(0, asset.issues_count - 1)
            asset.version += 1
            db.add_or_update_asset(asset)

    db.record_audit(
        actor=user.email,
        role=user.role,
        action=f"REVIEW_{decision.upper()}",
        target_entity="review_tasks",
        target_id=task.id,
        diff_payload={"original": task.original_text, "approved_text": payload.edited_text or task.suggested_text},
        notes=f"Human reviewer {decision}ed suggested fix for task '{task.id}'."
    )

    return {
        "success": True,
        "task": task,
        "asset": asset
    }

# ----------------- 8. AUDIT LOG & REPOSITORY -----------------
@app.get("/api/audit", response_model=List[AuditLogEntry])
def get_audit_trail(limit: int = 50):
    return db.list_audit_logs(limit=limit)

# ----------------- 9. DEMO WORKSPACE & EVALUATION -----------------
@app.post("/api/workspace/load-demo")
def load_demo():
    load_seed_workspace()
    return {"message": "NovaWear SmartWatch X demo workspace loaded successfully."}

@app.post("/api/eval/run")
def run_evaluation_suite():
    from .eval_runner import evaluate_test_set
    results = evaluate_test_set()
    return results
