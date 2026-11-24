import { officeApiBase } from './officeAuth';
import { GuestAssessmentResponse, GuestClaim, GuestProductInfo } from './guestVerification';

export type EvaluationDemoApprovalStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'revision_requested'
  | 'rejected'
  | 'reassessment_required';

export interface EvaluationDemoAsset {
  id: string;
  title: string;
  description: string;
  source_text: string;
  input_method: 'text' | 'image' | 'pdf';
  product: GuestProductInfo;
  claims: GuestClaim[];
  assessment: GuestAssessmentResponse | null;
  approval_status: EvaluationDemoApprovalStatus;
  version: number;
  created_at: string;
  updated_at: string;
  revision_history: Array<{
    version: number;
    updated_at: string;
    author: string;
    source_text: string;
    assessment: GuestAssessmentResponse | null;
    approval_status: EvaluationDemoApprovalStatus;
  }>;
  review_task_id?: string;
}

export interface EvaluationDemoEvent {
  id: string;
  type: string;
  title: string;
  details: string;
  timestamp: string;
  actor?: string;
  role?: string;
  session_id?: string;
  resource_id?: string;
  version?: number;
}

export interface EvaluationDemoReviewTask {
  id: string;
  assetId: string;
  assetTitle: string;
  assetType: 'website_page';
  trigger: 'content_scan';
  priority: 'high';
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  assignedRole: 'legal_compliance';
  createdAt: string;
  contentVersion: number;
  originalText: string;
  suggestedText: string;
  currentText: string;
  notes: string;
  reviewedBy?: string;
  reviewedAt?: string;
  auditTrail: Array<{
    action: string;
    by: string;
    role: string;
    timestamp: string;
    note?: string;
  }>;
}

const requestJson = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const apiBase = officeApiBase();
  const requestUrl = new URL(`${apiBase}${path}`, window.location.origin).toString();
  const method = init.method || 'GET';
  let response: Response;
  try {
    response = await fetch(requestUrl, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Could not connect to ${method} ${requestUrl}. Check the FastAPI server and try again.`);
    }
    throw error;
  }
  const payload = await response.json().catch(() => null) as
    | { detail?: string | Array<{ msg?: string }> }
    | T
    | null;
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'detail' in payload
      ? payload.detail
      : undefined;
    const detailMessage = typeof detail === 'string'
      ? detail
      : Array.isArray(detail) && typeof detail[0]?.msg === 'string'
        ? detail[0].msg
        : '';
    throw new Error(
      `${method} ${requestUrl} failed with HTTP ${response.status}${detailMessage ? `: ${detailMessage}` : '.'}`,
    );
  }
  if (payload === null) throw new Error('The Evaluation demo API returned an empty response.');
  return payload as T;
};

export const initializeEvaluationDemoSession = () =>
  requestJson<{ active: boolean; expiresIn: number }>('/api/evaluation/demo/session', {
    method: 'POST',
  });

export const listEvaluationDemoContent = () =>
  requestJson<{ assets: EvaluationDemoAsset[]; events: EvaluationDemoEvent[] }>(
    '/api/evaluation/demo/creator/content',
  );

export const saveEvaluationDemoContent = (draft: {
  id?: string;
  title: string;
  description: string;
  source_text: string;
  input_method: 'text' | 'image' | 'pdf';
  product: GuestProductInfo;
  claims: GuestClaim[];
  assessment: GuestAssessmentResponse | null;
}) =>
  requestJson<EvaluationDemoAsset>('/api/evaluation/demo/creator/content', {
    method: 'POST',
    body: JSON.stringify(draft),
  });

export const submitEvaluationDemoContent = (assetId: string) =>
  requestJson<{ asset: EvaluationDemoAsset; task: EvaluationDemoReviewTask }>(
    `/api/evaluation/demo/creator/content/${encodeURIComponent(assetId)}/submit`,
    { method: 'POST', body: '{}' },
  );

export const listEvaluationDemoReviewTasks = () =>
  requestJson<{ tasks: EvaluationDemoReviewTask[] }>('/api/evaluation/demo/reviewer/queue');

export const decideEvaluationDemoReview = (
  taskId: string,
  decision: 'approve' | 'reject' | 'request_revision',
  note: string,
  editedText?: string,
) =>
  requestJson<{ asset: EvaluationDemoAsset; task: EvaluationDemoReviewTask }>(
    `/api/evaluation/demo/reviewer/queue/${encodeURIComponent(taskId)}/decision`,
    {
      method: 'POST',
      body: JSON.stringify({ decision, note, edited_text: editedText }),
    },
  );
