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

class EvaluationDemoTransientError extends EvaluationDemoRequestError {}

class EvaluationDemoTransportError extends EvaluationDemoTransientError {}

export class EvaluationDemoSessionExpiredError extends EvaluationDemoRequestError {
  constructor(hasPreviousWork = false) {
    super('The Evaluation demo session could not be restored. Restart the demo to continue.');
    this.name = 'EvaluationDemoSessionExpiredError';
    this.hasPreviousWork = hasPreviousWork;
  }

  hasPreviousWork: boolean;
}

export type EvaluationDemoSessionStatus = 'idle' | 'restoring' | 'expired';

const SESSION_TOKEN_KEY = 'proofline.evaluation-demo.session-token';
const LEGACY_SESSION_MARKER = 'proofline.evaluation-demo.session-started';
const SESSION_WORK_MARKER = 'proofline.evaluation-demo.session-has-work';
const SESSION_HEADER = 'X-Proofline-Evaluation-Session';
const MAX_READ_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const sessionListeners = new Set<() => void>();
let sessionStatus: EvaluationDemoSessionStatus = 'idle';
let restorePromise: Promise<void> | null = null;
let restartPromise: Promise<void> | null = null;
let recoveryPromise: Promise<void> | null = null;
let sessionReady = false;

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

const waitBeforeRetry = (attempt: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, 350 * (2 ** (attempt - 1))));

const userMessageForStatus = (status: number) => {
  if (status === 401) return 'The Evaluation demo session could not be restored. Restart the demo to continue.';
  if (status === 403) return 'This demo action is not available in the current workspace.';
  if (status === 404) return 'The requested demo item is no longer available.';
  if (status === 409) return 'The demo workspace changed while this action was being saved. Refresh and try again.';
  if (status === 422) return 'Check the content and required fields, then try again.';
  if (status === 429) return 'The demo service is busy. Wait a moment and try again.';
  if (status >= 500) return 'The demo service is temporarily unavailable. Try again shortly.';
  return 'The demo request could not be completed. Please try again.';
};

const requestResponse = async (path: string, init: RequestInit = {}): Promise<Response> => {
  const apiBase = officeApiBase();
  const requestUrl = new URL(`${apiBase}${path}`, window.location.origin).toString();
  const method = init.method || 'GET';
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const token = readSessionToken();
  if (token) headers.set(SESSION_HEADER, token);
  try {
    return await fetch(requestUrl, {
      ...init,
      credentials: 'omit',
      headers,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      logDiagnostic({ method, path, issue: 'network' });
      throw new EvaluationDemoTransportError('Could not connect to Evaluation services. Check your connection and try again.');
    }
    throw error;
  }
};

const responseError = (path: string, method: string, status: number) => {
  logDiagnostic({ method, path, status });
  if (status === 401) return new EvaluationDemoSessionExpiredError();
  if (status === 409 && path.endsWith('/session/recover')) return new EvaluationDemoSessionExpiredError(true);
  if (RETRYABLE_STATUSES.has(status)) {
    return new EvaluationDemoTransientError(userMessageForStatus(status));
  }
  return new EvaluationDemoRequestError(userMessageForStatus(status));
};

const isSessionEndpoint = (path: string) => path.startsWith('/api/evaluation/demo/session');

type EvaluationDemoSessionResponse = {
  active: boolean;
  expiresIn: number;
  sessionToken?: string;
};

const readSessionToken = () => {
  try {
    return window.localStorage.getItem(SESSION_TOKEN_KEY)?.trim() || null;
  } catch {
    throw new EvaluationDemoRequestError('Browser storage is required to keep your demo session across workspaces.');
  }
};

const storeSessionToken = (token: string) => {
  if (!token) throw new EvaluationDemoRequestError('The demo session could not be saved in this browser.');
  try {
    window.localStorage.setItem(SESSION_TOKEN_KEY, token);
    window.localStorage.removeItem(LEGACY_SESSION_MARKER);
    window.localStorage.removeItem(SESSION_WORK_MARKER);
  } catch {
    throw new EvaluationDemoRequestError('Enable browser storage to keep your demo session across workspaces.');
  }
};

const hasPriorWork = () => {
  try {
    return window.localStorage.getItem(SESSION_WORK_MARKER) === '1'
      || window.localStorage.getItem(LEGACY_SESSION_MARKER) === '1';
  } catch {
    throw new EvaluationDemoRequestError('Browser storage is required to restore your demo session.');
  }
};

const markDemoWork = () => {
  try {
    window.localStorage.setItem(SESSION_WORK_MARKER, '1');
  } catch {
    throw new EvaluationDemoRequestError('Browser storage is required to preserve your demo session.');
  }
};

const createFreshSession = async () => {
  try {
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_SESSION_MARKER);
  } catch {
    throw new EvaluationDemoRequestError('Browser storage is required to restore your demo session.');
  }
  const session = await requestJson<EvaluationDemoSessionResponse>(
    '/api/evaluation/demo/session',
    { method: 'POST' },
  );
  if (session.sessionToken) storeSessionToken(session.sessionToken);
  if (!readSessionToken()) throw new EvaluationDemoRequestError('The demo session could not be saved in this browser.');
};

const recoverOrCreateSession = async () => {
  try {
    const session = await requestJson<EvaluationDemoSessionResponse>(
      '/api/evaluation/demo/session/recover',
      { method: 'POST' },
    );
    if (session.sessionToken) storeSessionToken(session.sessionToken);
    if (!readSessionToken()) throw new EvaluationDemoSessionExpiredError();
  } catch (error) {
    if (
      !(error instanceof EvaluationDemoSessionExpiredError)
      || error.hasPreviousWork
      || hasPriorWork()
    ) throw error;
    await createFreshSession();
  }
};

const recoverActiveSession = (): Promise<void> => {
  if (recoveryPromise) return recoveryPromise;
  setSessionStatus('restoring');
  sessionReady = false;
  recoveryPromise = recoverOrCreateSession()
    .then(() => {
      sessionReady = true;
      setSessionStatus('idle');
    })
    .catch((error: unknown) => {
      sessionReady = false;
      setSessionStatus(error instanceof EvaluationDemoSessionExpiredError ? 'expired' : 'idle');
      throw error;
    })
    .finally(() => { recoveryPromise = null; });
  return recoveryPromise;
};

const requestJson = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const method = init.method || 'GET';
  const sessionEndpoint = isSessionEndpoint(path);
  const canRetry = method === 'GET'
    || method === 'HEAD'
    || path.endsWith('/session/recover');
  if (!sessionEndpoint) await restoreEvaluationDemoSession();

  let transientRetries = 0;
  let recovered = false;
  while (true) {
    let response: Response;
    try {
      response = await requestResponse(path, init);
    } catch (error) {
      if (!(error instanceof EvaluationDemoTransportError) || !canRetry || transientRetries >= MAX_READ_ATTEMPTS - 1) {
        throw error;
      }
      transientRetries += 1;
      logDiagnostic({ method, path, retry: transientRetries });
      await waitBeforeRetry(transientRetries);
      continue;
    }

    if (response.status === 401 && !sessionEndpoint) {
      if (recovered) {
        setSessionStatus('expired');
        throw responseError(path, method, response.status);
      }
      recovered = true;
      try {
        await recoverActiveSession();
      } catch (error) {
        if (!(error instanceof EvaluationDemoTransientError) || !canRetry || transientRetries >= MAX_READ_ATTEMPTS - 1) {
          throw error;
        }
        transientRetries += 1;
        recovered = false;
        logDiagnostic({ method, path, retry: transientRetries, issue: 'session-recovery' });
        await waitBeforeRetry(transientRetries);
      }
      continue;
    }

    if (canRetry && RETRYABLE_STATUSES.has(response.status) && transientRetries < MAX_READ_ATTEMPTS - 1) {
      transientRetries += 1;
      logDiagnostic({ method, path, status: response.status, retry: transientRetries });
      await waitBeforeRetry(transientRetries);
      continue;
    }

    if (!response.ok) throw responseError(path, method, response.status);
    const payload = await response.json().catch(() => null) as T | null;
    if (payload === null) throw new Error('The Evaluation demo API returned an empty response.');
    return payload as T;
  }
};

const hasStartedSession = () => {
  try {
    return window.localStorage.getItem(LEGACY_SESSION_MARKER) === '1';
  } catch {
    throw new EvaluationDemoRequestError('Browser storage is required to restore your demo session.');
  }
};

export const restoreEvaluationDemoSession = (): Promise<void> => {
  if (sessionReady && readSessionToken()) return Promise.resolve();
  if (recoveryPromise) return recoveryPromise;
  if (restorePromise) return restorePromise;
  setSessionStatus('restoring');
  const restore = async () => {
    const token = readSessionToken();
    const path = token || hasStartedSession() || hasPriorWork()
      ? '/api/evaluation/demo/session/recover'
      : '/api/evaluation/demo/session';
    if (path.endsWith('/recover')) {
      await recoverOrCreateSession();
    } else {
      const session = await requestJson<EvaluationDemoSessionResponse>(path, { method: 'POST' });
      if (session.sessionToken) storeSessionToken(session.sessionToken);
      if (!readSessionToken()) {
        throw new EvaluationDemoRequestError('The demo session could not be saved in this browser.');
      }
    }
  };
  restorePromise = (async () => {
    const lockManager = typeof navigator === 'undefined' ? undefined : navigator.locks;
    if (lockManager) {
      await lockManager.request('proofline-evaluation-demo-session', restore);
    } else {
      await restore();
    }
  })()
    .then(() => {
      sessionReady = true;
      setSessionStatus('idle');
    })
    .catch((error: unknown) => {
      sessionReady = false;
      setSessionStatus(error instanceof EvaluationDemoSessionExpiredError ? 'expired' : 'idle');
      throw error;
    })
    .finally(() => { restorePromise = null; });
  return restorePromise;
};

export const restartEvaluationDemoSession = (): Promise<void> => {
  if (restartPromise) return restartPromise;
  setSessionStatus('restoring');
  restartPromise = requestJson<EvaluationDemoSessionResponse>(
    '/api/evaluation/demo/session/restart',
    { method: 'POST' },
  )
    .then((session) => {
      if (session.sessionToken) storeSessionToken(session.sessionToken);
      if (!readSessionToken()) {
        throw new EvaluationDemoRequestError('The demo session could not be saved in this browser.');
      }
      sessionReady = true;
      setSessionStatus('idle');
    })
    .catch((error: unknown) => {
      sessionReady = false;
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

export const saveEvaluationDemoContent = async (draft: {
  id?: string;
  title: string;
  description: string;
  source_text: string;
  input_method: 'text' | 'image' | 'pdf';
  product: GuestProductInfo;
  claims: GuestClaim[];
  assessment: GuestAssessmentResponse | null;
}) => {
  const asset = await requestJson<EvaluationDemoAsset>('/api/evaluation/demo/creator/content', {
    method: 'POST',
    body: JSON.stringify(draft),
  });
  markDemoWork();
  return asset;
};

export const submitEvaluationDemoContent = async (assetId: string) => {
  const submission = await requestJson<{ asset: EvaluationDemoAsset; task: EvaluationDemoReviewTask }>(
    `/api/evaluation/demo/creator/content/${encodeURIComponent(assetId)}/submit`,
    { method: 'POST', body: '{}' },
  );
  markDemoWork();
  return submission;
};

export const listEvaluationDemoReviewTasks = () =>
  requestJson<{ tasks: EvaluationDemoReviewTask[] }>('/api/evaluation/demo/reviewer/queue');

export const decideEvaluationDemoReview = async (
  taskId: string,
  decision: 'approve' | 'reject' | 'request_revision',
  note: string,
  editedText?: string,
) => {
  const result = await requestJson<{ asset: EvaluationDemoAsset; task: EvaluationDemoReviewTask }>(
    `/api/evaluation/demo/reviewer/queue/${encodeURIComponent(taskId)}/decision`,
    {
      method: 'POST',
      body: JSON.stringify({ decision, note, edited_text: editedText }),
    },
  );
  markDemoWork();
  return result;
};
