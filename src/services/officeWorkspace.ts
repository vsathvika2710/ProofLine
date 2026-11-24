import { getOfficeSession, officeApiBase, OfficeRole } from './officeAuth';
import {
  EvaluationDemoAsset,
  EvaluationDemoEvent,
  EvaluationDemoReviewTask,
} from './evaluationDemoWorkspace';
import { GuestAssessmentResponse, GuestClaim, GuestEvidenceItem } from './guestVerification';
import type {
  AuditLogEntry,
  ChangeImpactResult,
  ContentAsset as DashboardAsset,
  EvidenceDocument,
  Fact,
  ReviewTask,
  UserRole,
} from '../types';

interface OfficeClaim {
  id: string;
  claim_text: string;
  claim_type: string;
  verification_status: string;
  confidence: number;
  reason: string;
  quoted_passage?: string | null;
  source_document_title?: string | null;
  suggested_correction?: string | null;
  created_at?: string | null;
}

interface OfficeAsset {
  id: string;
  title: string;
  asset_type: string;
  channel: string;
  raw_text: string;
  approval_status: string;
  last_scanned_at?: string | null;
  claims_count?: number;
  issues_count?: number;
  linked_fact_ids?: string[];
  assigned_reviewer?: string | null;
  last_approved_by?: string | null;
  last_approved_at?: string | null;
  version: number;
  created_at?: string | null;
  review_task_id?: string | null;
  revision_history?: Array<{
    version: number;
    updated_at: string;
    author: string;
    source_text: string;
    approval_status: string;
  }>;
  approval_history?: Array<{
    version: number;
    approved_by: string;
    approved_at: string;
    review_task_id: string;
  }>;
  claims?: OfficeClaim[];
}

interface OfficeTask {
  id: string;
  asset_id: string;
  asset_title: string;
  asset_type: string;
  trigger_type: string;
  priority: string;
  status: string;
  assigned_role: string;
  created_at?: string | null;
  content_version: number;
  original_text: string;
  suggested_text: string;
  explanation: string;
  cited_source: string;
  decision_notes?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  decision_history?: Array<{
    decision: string;
    reviewer: string;
    role: string;
    notes?: string | null;
    decided_at: string;
  }>;
}

interface OfficeAuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  actor_role: string;
  action: string;
  target_entity: string;
  target_id?: string | null;
  notes?: string | null;
}

export interface OfficeFactVersion {
  fact: {
    id: string;
    name: string;
    current_value: string;
    version: string;
    source_document_title?: string | null;
    source_passage: string;
  };
  recorded_at: string;
  recorded_by: string;
}

interface OfficeReviewerPayload {
  assets: OfficeAsset[];
  tasks: OfficeTask[];
  events: OfficeAuditEvent[];
  fact_history: OfficeFactVersion[];
}

interface OfficeCreatorPayload {
  assets: OfficeAsset[];
  events: OfficeAuditEvent[];
}

interface OfficeDocument {
  id: string;
  title: string;
  doc_type: string;
  owner: string;
  version: string;
  approval_status: string;
  effective_date: string;
  expiry_date?: string | null;
  raw_text: string;
  created_at?: string | null;
}

interface OfficeFact {
  id: string;
  fact_key: string;
  name: string;
  current_value: string;
  source_document_id?: string | null;
  source_document_title?: string | null;
  source_passage: string;
  version: string;
  effective_date?: string | null;
  updated_at?: string | null;
}

interface OfficeImpactPayload {
  event_id: string;
  fact_id: string;
  fact_name: string;
  old_value: string;
  new_value: string;
  timestamp: string;
  total_assets_scanned: number;
  affected_assets: Array<{
    asset_id: string;
    asset_title: string;
    asset_type: string;
    channel: string;
    affected_claims: Array<{ claim_text: string; reason: string; suggested_fix: string }>;
    impact_severity: 'high' | 'medium' | 'low';
  }>;
  unaffected_assets: Array<{ asset_id: string; asset_title: string; checked_reason: string }>;
}

const requestOffice = async <T>(
  path: string,
  role: OfficeRole,
  init: RequestInit = {},
): Promise<T> => {
  const session = await getOfficeSession();
  if (!session) throw new Error('Your Office session has expired. Sign in again.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  headers.set('X-Proofline-Active-Role', role);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${officeApiBase()}${path}`, {
    ...init,
    headers,
  });
  const payload = await response.json().catch(() => null) as { detail?: string } | T | null;
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'detail' in payload
      ? payload.detail
      : undefined;
    throw new Error(typeof detail === 'string' ? detail : `Office request failed (${response.status}).`);
  }
  if (payload === null) throw new Error('The Office service returned an empty response.');
  return payload as T;
};

const claimType = (value: string): GuestClaim['claim_type'] => {
  if (value === 'numeric') return 'specification';
  if (value === 'date') return 'other';
  if (value === 'comparative' || value === 'promotional' || value === 'warranty' || value === 'battery' || value === 'pricing' || value === 'performance') return value;
  return 'other';
};

const verificationStatus = (value: string): GuestAssessmentResponse['findings'][number]['status'] => {
  if (value === 'supported' || value === 'contradicted' || value === 'unsupported') return value;
  return 'inconclusive';
};

const verificationLimitation = (value: string) =>
  value === 'outdated' ? 'The organization fact changed; this claim requires reassessment before approval.' : null;

const approvalStatus = (value: string): EvaluationDemoAsset['approval_status'] =>
  value === 'approval_invalidated' ? 'reassessment_required'
    : value === 'under_review' ? 'in_review'
      : value === 'rejected' || value === 'revision_requested' || value === 'approved' ? value
        : 'draft';

const toAsset = (asset: OfficeAsset): EvaluationDemoAsset => {
  const officeClaims = asset.claims || [];
  const claims: GuestClaim[] = officeClaims.map((claim) => ({
    id: claim.id,
    text: claim.claim_text,
    normalized: claim.claim_text.toLowerCase(),
    claim_type: claimType(claim.claim_type),
  }));
  const findings = officeClaims.map((claim) => {
    const evidence: GuestEvidenceItem[] = claim.quoted_passage && claim.source_document_title
      ? [{
          id: `${claim.id}-citation`,
          claim_id: claim.id,
          source_type: 'office_approved',
          source_title: claim.source_document_title,
          passage: claim.quoted_passage,
          source_url: null,
          retrieved_at: claim.created_at || asset.created_at || '',
          relevance_score: claim.confidence,
          topic: claim.claim_type,
        }]
      : [];
    return {
      claim_id: claim.id,
      original_claim: claim.claim_text,
      normalized_claim: claim.claim_text.toLowerCase(),
      claim_type: claimType(claim.claim_type),
      status: verificationStatus(claim.verification_status),
      explanation: claim.reason,
      evidence,
      suggested_correction: claim.suggested_correction || null,
      limitation: verificationLimitation(claim.verification_status),
    };
  });
  return {
    id: asset.id,
    title: asset.title,
    description: asset.channel,
    source_text: asset.raw_text,
    input_method: 'text',
    product: { name: null, brand: null, category: null, model: null, identification: 'uncertain' },
    claims,
    assessment: findings.length ? {
      product: { name: null, brand: null },
      input_method: 'text',
      findings,
      evidence_source_note: 'Citations are limited to this organization’s approved evidence.',
      assessed_at: asset.created_at || '',
      processing_notice: 'Automated verification is advisory; the reviewer makes the final decision.',
    } : null,
    approval_status: approvalStatus(asset.approval_status),
    version: asset.version,
    created_at: asset.created_at || '',
    updated_at: asset.created_at || '',
    revision_history: (asset.revision_history || []).map((revision) => ({
      version: revision.version,
      updated_at: revision.updated_at,
      author: revision.author,
      source_text: revision.source_text,
      assessment: null,
      approval_status: approvalStatus(revision.approval_status),
    })),
    review_task_id: undefined,
  };
};

const toTask = (task: OfficeTask): EvaluationDemoReviewTask => ({
  id: task.id,
  assetId: task.asset_id,
  assetTitle: task.asset_title,
  assetType: 'website_page',
  trigger: 'content_scan',
  priority: 'high',
  status: task.status === 'edited' ? 'modified' : task.status as EvaluationDemoReviewTask['status'],
  assignedRole: 'legal_compliance',
  createdAt: task.created_at || '',
  contentVersion: task.content_version,
  originalText: task.original_text,
  suggestedText: task.suggested_text,
  currentText: task.original_text,
  notes: task.decision_notes || task.explanation,
  reviewedBy: task.decided_by || undefined,
  reviewedAt: task.decided_at || undefined,
  auditTrail: (task.decision_history || []).map((entry) => ({
    action: entry.decision,
    by: entry.reviewer,
    role: entry.role,
    timestamp: entry.decided_at,
    note: entry.notes || undefined,
  })),
});

const toEvent = (event: OfficeAuditEvent): EvaluationDemoEvent => ({
  id: event.id,
  type: event.action.toLowerCase(),
  title: event.action.replaceAll('_', ' ').toLowerCase(),
  details: event.notes || `${event.target_entity}${event.target_id ? ` · ${event.target_id}` : ''}`,
  timestamp: event.timestamp,
  actor: event.actor,
  role: event.actor_role,
  resource_id: event.target_id || undefined,
});

const dashboardRole = (role: string): UserRole => {
  if (role === 'admin' || role === 'brand_manager') return 'brand_manager';
  if (role === 'creator' || role === 'content_creator') return 'content_creator';
  return 'legal_compliance';
};

const dashboardAsset = (asset: OfficeAsset): DashboardAsset => ({
  id: asset.id,
  title: asset.title,
  type: asset.asset_type as DashboardAsset['type'],
  channel: asset.channel,
  urlOrPath: '',
  status: asset.approval_status === 'approval_invalidated' ? 'approval_invalidated'
    : asset.approval_status === 'under_review' ? 'under_review'
      : asset.approval_status === 'approved' ? 'approved'
        : asset.approval_status === 'rejected' ? 'rejected'
          : asset.approval_status === 'revision_requested' ? 'revision_requested'
            : 'draft',
  lastScanned: asset.last_scanned_at || '',
  content: asset.raw_text,
  linkedFactIds: asset.linked_fact_ids || [],
  claimsCount: asset.claims_count || asset.claims?.length || 0,
  issuesCount: asset.issues_count || asset.claims?.filter((claim) => claim.verification_status !== 'supported').length || 0,
  assignedReviewer: asset.assigned_reviewer || '',
  lastApprovedBy: asset.last_approved_by || undefined,
  lastApprovedDate: asset.last_approved_at || undefined,
});

const dashboardTask = (task: OfficeTask): ReviewTask => ({
  id: task.id,
  assetId: task.asset_id,
  assetTitle: task.asset_title,
  assetType: task.asset_type as ReviewTask['assetType'],
  trigger: task.trigger_type === 'fact_change_cascade' ? 'fact_change_cascade' : 'content_scan',
  priority: task.priority as ReviewTask['priority'],
  status: task.status === 'edited' ? 'modified' : task.status as ReviewTask['status'],
  assignedRole: dashboardRole(task.assigned_role),
  createdAt: task.created_at || '',
  originalText: task.original_text,
  suggestedText: task.suggested_text,
  currentText: task.original_text,
  notes: task.decision_notes || task.explanation,
  reviewedBy: task.decided_by || undefined,
  reviewedAt: task.decided_at || undefined,
  auditTrail: (task.decision_history || []).map((entry) => ({
    action: entry.decision,
    by: entry.reviewer,
    role: entry.role,
    timestamp: entry.decided_at,
    note: entry.notes || undefined,
  })),
});

const dashboardAudit = (event: OfficeAuditEvent): AuditLogEntry => {
  const action: AuditLogEntry['action'] = [
    'FACT_UPDATED',
    'IMPACT_EVALUATED',
    'APPROVAL_INVALIDATED',
    'CORRECTION_APPLIED',
    'CONTENT_APPROVED',
    'OVERRIDE_GRANTED',
    'ASSET_CREATED',
  ].includes(event.action as AuditLogEntry['action'])
    ? event.action as AuditLogEntry['action']
    : 'ASSET_CREATED';
  return {
    id: event.id,
    timestamp: event.timestamp,
    actor: event.actor,
    role: dashboardRole(event.actor_role),
    action,
    target: event.target_entity,
    details: event.notes || `${event.target_entity}${event.target_id ? ` · ${event.target_id}` : ''}`,
  };
};

const dashboardFact = (fact: OfficeFact): Fact => {
  const key = fact.fact_key.toLowerCase();
  const category: Fact['category'] = key.includes('policy') || key.includes('warranty') || key.includes('price')
    ? 'Pricing & Policy'
    : key.includes('ingredient') || key.includes('storage') ? 'Ingredients & Storage'
      : key.includes('brand') ? 'Brand Identity' : 'Product Specs';
  return {
    id: fact.id,
    code: fact.fact_key,
    name: fact.name,
    category,
    currentValue: fact.current_value,
    lastUpdated: fact.updated_at || '',
    version: fact.version,
    owner: 'Authorized organization',
    status: 'active',
    sourceDocId: fact.source_document_id || '',
    sourceDocName: fact.source_document_title || 'Manual citation',
    sourcePassage: fact.source_passage,
    effectiveDate: fact.effective_date || '',
    expiryDate: '',
    tags: [],
  };
};

const dashboardDocument = (document: OfficeDocument): EvidenceDocument => {
  const expired = Boolean(document.expiry_date && new Date(document.expiry_date).getTime() < Date.now());
  return {
    id: document.id,
    title: document.title,
    docNumber: document.id,
    category: document.doc_type,
    version: document.version,
    owner: document.owner,
    approvedDate: document.effective_date,
    expiryDate: document.expiry_date || '',
    status: expired ? 'expired' : 'valid',
    summary: document.raw_text.slice(0, 240),
    sections: [{ heading: document.title, text: document.raw_text }],
  };
};

const dashboardImpact = (result: OfficeImpactPayload): ChangeImpactResult => ({
  factId: result.fact_id,
  factName: result.fact_name,
  oldValue: result.old_value,
  newValue: result.new_value,
  timestamp: result.timestamp,
  totalAssetsScanned: result.total_assets_scanned,
  affectedAssets: result.affected_assets.map((asset) => ({
    assetId: asset.asset_id,
    assetTitle: asset.asset_title,
    assetType: asset.asset_type as DashboardAsset['type'],
    channel: asset.channel,
    affectedClaims: asset.affected_claims.map((claim) => ({
      claimText: claim.claim_text,
      reason: claim.reason,
      suggestedFix: claim.suggested_fix,
    })),
    impactSeverity: asset.impact_severity,
  })),
  unaffectedAssets: result.unaffected_assets.map((asset) => ({
    assetId: asset.asset_id,
    assetTitle: asset.asset_title,
    checkedReason: asset.checked_reason,
  })),
});

export async function listOfficeReviewerWorkspace() {
  const data = await requestOffice<OfficeReviewerPayload>('/api/reviewer/workspace', 'reviewer');
  return {
    assets: data.assets.map(toAsset),
    events: data.events.map(toEvent),
    tasks: data.tasks.map(toTask),
    factHistory: data.fact_history,
  };
}

export async function decideOfficeReview(
  taskId: string,
  decision: 'approve' | 'reject' | 'request_revision',
  note: string,
  role: 'reviewer' | 'admin' = 'reviewer',
) {
  return requestOffice(
    `/api/reviews/${encodeURIComponent(taskId)}/decision`,
    role,
    {
      method: 'POST',
      body: JSON.stringify({ decision, notes: note }),
    },
  );
}

export async function listOfficeCreatorWorkspace() {
  const data = await requestOffice<OfficeCreatorPayload>('/api/creator/workspace', 'creator');
  return {
    assets: data.assets.map(toAsset),
    events: data.events.map(toEvent),
  };
}

export async function saveOfficeContent(input: {
  id?: string;
  title: string;
  assetType: string;
  channel: string;
  rawText: string;
}) {
  if (!input.id) {
    const asset = await requestOffice<OfficeAsset>('/api/content', 'creator', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        asset_type: input.assetType,
        channel: input.channel,
        raw_text: input.rawText,
      }),
    });
    return toAsset(asset);
  }
  const result = await requestOffice<{ asset: OfficeAsset; claims: OfficeClaim[] }>(
    `/api/content/${encodeURIComponent(input.id)}`,
    'creator',
    {
      method: 'PUT',
      body: JSON.stringify({
        title: input.title,
        asset_type: input.assetType,
        channel: input.channel,
        raw_text: input.rawText,
      }),
    },
  );
  return toAsset({ ...result.asset, claims: result.claims });
}

export async function submitOfficeContentAsset(assetId: string) {
  return requestOffice(
    `/api/content/${encodeURIComponent(assetId)}/submit`,
    'creator',
    { method: 'POST', body: '{}' },
  );
}

interface OfficeScanPayload {
  claims_found: number;
  claims: OfficeClaim[];
  ai_notice: string;
}

export async function scanOfficeClaims(rawText: string): Promise<GuestAssessmentResponse> {
  const result = await requestOffice<OfficeScanPayload>('/api/claims/scan-text', 'creator', {
    method: 'POST',
    body: JSON.stringify({ text: rawText }),
  });
  return {
    product: { name: null, brand: null },
    input_method: 'text',
    findings: result.claims.map((claim) => ({
      claim_id: claim.id,
      original_claim: claim.claim_text,
      normalized_claim: claim.claim_text.toLowerCase(),
      claim_type: claimType(claim.claim_type),
      status: verificationStatus(claim.verification_status),
      explanation: claim.reason,
      evidence: claim.quoted_passage && claim.source_document_title
        ? [{
            id: `${claim.id}-citation`,
            claim_id: claim.id,
            source_type: 'office_approved',
            source_title: claim.source_document_title,
            passage: claim.quoted_passage,
            source_url: null,
            retrieved_at: claim.created_at || new Date().toISOString(),
            relevance_score: claim.confidence,
            topic: claim.claim_type,
          }]
        : [],
      suggested_correction: claim.suggested_correction || null,
      limitation: verificationLimitation(claim.verification_status),
    })),
    evidence_source_note: 'Verification uses only approved evidence and facts in the authenticated organization.',
    assessed_at: new Date().toISOString(),
    processing_notice: result.ai_notice,
  };
}

export async function listOfficeAdminWorkspace() {
  const [facts, documents, assets, tasks, events] = await Promise.all([
    requestOffice<OfficeFact[]>('/api/facts', 'admin'),
    requestOffice<OfficeDocument[]>('/api/evidence', 'admin'),
    requestOffice<OfficeAsset[]>('/api/content', 'admin'),
    requestOffice<OfficeTask[]>('/api/reviews', 'admin'),
    requestOffice<OfficeAuditEvent[]>('/api/audit?limit=200', 'admin'),
  ]);
  return {
    facts: facts.map(dashboardFact),
    documents: documents.map(dashboardDocument),
    assets: assets.map(dashboardAsset),
    tasks: tasks.map(dashboardTask),
    auditLogs: events.map(dashboardAudit),
  };
}

export async function createOfficeFact(fact: Fact) {
  const result = await requestOffice<OfficeFact>('/api/facts', 'admin', {
    method: 'POST',
    body: JSON.stringify({
      fact_key: fact.code,
      name: fact.name,
      current_value: fact.currentValue,
      source_document_id: fact.sourceDocId || null,
      source_passage: fact.sourcePassage,
      version: fact.version,
    }),
  });
  return dashboardFact(result);
}

export async function changeOfficeFact(factId: string, newValue: string) {
  const result = await requestOffice<OfficeImpactPayload>('/api/impact/change-fact', 'admin', {
    method: 'POST',
    body: JSON.stringify({ fact_id: factId, new_value: newValue }),
  });
  return dashboardImpact(result);
}
