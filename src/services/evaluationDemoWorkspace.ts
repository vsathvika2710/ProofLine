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

export class EvaluationDemoRequestError extends Error {}

export class EvaluationDemoSessionExpiredError extends EvaluationDemoRequestError {
  constructor() {
    super('The Evaluation demo session could not be restored. Restart the demo to continue.');
    this.name = 'EvaluationDemoSessionExpiredError';
  }
}

export type EvaluationDemoSessionStatus = 'idle' | 'restoring' | 'expired';

const SESSION_MARKER = 'proofline.evaluation-demo.session-started';
const sessionListeners = new Set<() => void>();
let sessionStatus: EvaluationDemoSessionStatus = 'idle';
let restorePromise: Promise<void> | null = null;
let restartPromise: Promise<void> | null = null;
let recoveryPromise: Promise<void> | null = null;

const setSessionStatus = (status: EvaluationDemoSessionStatus) => {
  if (sessionStatus === status) return;
  sessionStatus = status;
  sessionListeners.forEach((listener) => listener());
};

export const getEvaluationDemoSessionStatus = () => sessionStatus;

export const subscribeEvaluationDemoSessionStatus = (listener: () => void) => {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
};

const logDiagnostic = (details: Record<string, string | number>) => {
  if (import.meta.env.DEV) console.warn('[Evaluation demo]', details);
};

const userMessageForStatus = (status: number) => {
  if (status === 401) return 'The Evaluation demo session could not be restored. Restart the demo to continue.';
  if (status === 403) return 'This demo action is not available in the current workspace.';
  if (status === 404) return 'The requested demo item is no longer available.';
  if (status === 409) return 'This demo item changed. Refresh the workspace and try again.';
  if (status === 422) return 'Check the content and required fields, then try again.';
  if (status === 429) return 'The demo service is busy. Wait a moment and try again.';
  if (status >= 500) return 'The demo service is temporarily unavailable. Try again shortly.';
  return 'The demo request could not be completed. Please try again.';
};

const requestResponse = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const apiBase = officeApiBase();
  const requestUrl = new URL(`${apiBase}${path}`, window.location.origin).toString();
  const method = init.method || 'GET';
  try {
    return await fetch(requestUrl, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      logDiagnostic({ method, path, issue: 'network' });
      throw new EvaluationDemoRequestError('Could not connect to Evaluation services. Check your connection and try again.');
    }
    throw error;
  }
};

const responseError = (path: string, method: string, status: number) => {
  logDiagnostic({ method, path, status });
  if (status === 401) return new EvaluationDemoSessionExpiredError();
  return new EvaluationDemoRequestError(userMessageForStatus(status));
};

const isSessionEndpoint = (path: string) => path.startsWith('/api/evaluation/demo/session');

const recoverActiveSession = (): Promise<void> => {
  if (recoveryPromise) return recoveryPromise;
  setSessionStatus('restoring');
  recoveryPromise = (async () => {
    const response = await requestResponse('/api/evaluation/demo/session/recover', { method: 'POST' });
    if (!response.ok) throw responseError('/api/evaluation/demo/session/recover', 'POST', response.status);
  })()
    .then(() => setSessionStatus('idle'))
    .catch((error: unknown) => {
      setSessionStatus(error instanceof EvaluationDemoSessionExpiredError ? 'expired' : 'idle');
      throw error;
    })
    .finally(() => { recoveryPromise = null; });
  return recoveryPromise;
};

const requestJson = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const method = init.method || 'GET';
  let response = await requestResponse(path, init);

  if (response.status === 401 && !isSessionEndpoint(path)) {
    await recoverActiveSession();
    response = await requestResponse(path, init);
    if (response.status === 401) {
      setSessionStatus('expired');
      throw responseError(path, method, response.status);
    }
  }

  if (!response.ok) {
    throw responseError(path, method, response.status);
  }

  const payload = await response.json().catch(() => null) as T | null;
  if (payload === null) throw new Error('The Evaluation demo API returned an empty response.');
  return payload as T;
};

const hasStartedSession = () => {
  try {
    return window.localStorage.getItem(SESSION_MARKER) === '1';
  } catch {
    return false;
  }
};

const markSessionStarted = () => {
  try {
    window.localStorage.setItem(SESSION_MARKER, '1');
  } catch {
    logDiagnostic({ issue: 'session marker unavailable' });
  }
};

export const restoreEvaluationDemoSession = (): Promise<void> => {
  if (restorePromise) return restorePromise;
  setSessionStatus('restoring');
  const path = hasStartedSession()
    ? '/api/evaluation/demo/session/recover'
    : '/api/evaluation/demo/session';
  restorePromise = requestJson<{ active: boolean; expiresIn: number }>(path, { method: 'POST' })
    .then(() => {
      markSessionStarted();
      setSessionStatus('idle');
    })
    .catch((error: unknown) => {
      setSessionStatus(error instanceof EvaluationDemoSessionExpiredError ? 'expired' : 'idle');
      throw error;
    })
    .finally(() => { restorePromise = null; });
  return restorePromise;
};

export const restartEvaluationDemoSession = (): Promise<void> => {
  if (restartPromise) return restartPromise;
  setSessionStatus('restoring');
  restartPromise = requestJson<{ active: boolean; expiresIn: number }>(
    '/api/evaluation/demo/session/restart',
    { method: 'POST' },
  )
    .then(() => {
      markSessionStarted();
      setSessionStatus('idle');
    })
    .catch((error: unknown) => {
      setSessionStatus('expired');
      throw error;
    })
    .finally(() => { restartPromise = null; });
  return restartPromise;
};

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
