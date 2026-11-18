from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime, date

ClaimType = Literal['numeric', 'comparative', 'date', 'promotional', 'other']
ClaimStatus = Literal['supported', 'contradicted', 'unsupported', 'outdated', 'needs_human_review', 'not_affected']
AssetStatus = Literal['approved', 'approval_invalidated', 'under_review', 'draft']
UserRole = Literal['admin', 'creator', 'reviewer', 'legal_compliance']
TaskStatus = Literal['pending', 'approved', 'rejected', 'edited']

class EvidenceDocument(BaseModel):
    id: str
    title: str
    doc_type: Literal['pdf', 'docx', 'txt']
    owner: str
    version: str = "v1.0"
    approval_status: str = "approved"
    effective_date: str
    expiry_date: Optional[str] = None
    file_path: Optional[str] = None
    raw_text: str
    chunk_count: int = 0
    created_at: Optional[str] = None

class EvidenceChunk(BaseModel):
    id: str
    document_id: str
    document_title: Optional[str] = None
    chunk_index: int
    passage_text: str
    section_title: Optional[str] = None
    embedding: Optional[List[float]] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class StructuredFact(BaseModel):
    id: str
    fact_key: str
    name: str
    current_value: str
    unit: Optional[str] = None
    source_document_id: Optional[str] = None
    source_document_title: Optional[str] = None
    source_passage: str
    version: str = "v1.0"
    effective_date: Optional[str] = None
    updated_at: Optional[str] = None

class ContentAsset(BaseModel):
    id: str
    title: str
    asset_type: Literal['website_page', 'sales_brochure', 'instagram_post', 'email_newsletter', 'support_faq']
    channel: str
    raw_text: str
    approval_status: AssetStatus = "draft"
    last_scanned_at: Optional[str] = None
    claims_count: int = 0
    issues_count: int = 0
    linked_fact_ids: List[str] = Field(default_factory=list)
    assigned_reviewer: Optional[str] = None
    last_approved_by: Optional[str] = None
    last_approved_at: Optional[str] = None
    version: int = 1
    created_at: Optional[str] = None

class Claim(BaseModel):
    id: str
    asset_id: str
    claim_text: str
    claim_type: ClaimType
    exact_source_sentence: str
    location_start: int = 0
    location_end: int = 0
    matched_fact_id: Optional[str] = None
    matched_fact_name: Optional[str] = None
    verification_status: ClaimStatus
    confidence: float = 0.95
    reason: str
    quoted_passage: Optional[str] = None
    source_document_title: Optional[str] = None
    suggested_correction: Optional[str] = None
    created_at: Optional[str] = None

class AffectedClaimItem(BaseModel):
    claim_id: Optional[str] = None
    claim_text: str
    exact_source_sentence: str
    reason: str
    suggested_fix: str
    cited_source: str
    status: ClaimStatus = "outdated"

class AffectedAssetItem(BaseModel):
    asset_id: str
    asset_title: str
    asset_type: str
    channel: str
    affected_claims: List[AffectedClaimItem]
    status: str = "approval_invalidated"
    impact_severity: Literal['high', 'medium', 'low'] = "high"

class UnaffectedAssetItem(BaseModel):
    asset_id: str
    asset_title: str
    asset_type: str
    claim_found: str
    checked_reason: str
    status: str = "not_affected"

class ChangeImpactResult(BaseModel):
    event_id: str
    fact_id: str
    fact_key: str
    fact_name: str
    old_value: str
    new_value: str
    source_doc: str
    timestamp: str
    total_assets_scanned: int
    items_need_review: int
    items_unaffected: int
    affected_assets: List[AffectedAssetItem]
    unaffected_assets: List[UnaffectedAssetItem]
    tasks_created_count: int

class ReviewTask(BaseModel):
    id: str
    asset_id: str
    asset_title: str
    asset_type: str
    claim_id: Optional[str] = None
    impact_event_id: Optional[str] = None
    trigger_type: Literal['fact_change_cascade', 'content_scan', 'manual'] = "fact_change_cascade"
    priority: Literal['critical', 'high', 'medium', 'low'] = "high"
    assigned_role: UserRole = "reviewer"
    assigned_user: Optional[str] = None
    original_text: str
    suggested_text: str
    explanation: str
    cited_source: str
    status: TaskStatus = "pending"
    decision_notes: Optional[str] = None
    decided_by: Optional[str] = None
    decided_at: Optional[str] = None
    created_at: Optional[str] = None

class AuditLogEntry(BaseModel):
    id: str
    timestamp: str
    actor: str
    actor_role: str
    action: str
    target_entity: str
    target_id: Optional[str] = None
    diff_payload: Dict[str, Any] = Field(default_factory=dict)
    notes: Optional[str] = None
