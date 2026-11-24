import { officeApiBase } from './officeAuth';

const FEATURE_CHECK_TIMEOUT_MS = 90000;
const FEATURE_CHECK_ATTEMPTS = 3;
const FEATURE_CHECK_CACHE_MS = 15000;
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
let inFlightCheck: Promise<boolean> | null = null;
let cachedFeatureCheck: { enabled: boolean; expiresAt: number } | null = null;

class FeatureCheckError extends Error {}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

const isRetryableStatus = (status: number) => RETRYABLE_STATUSES.has(status);

async function fetchFeatureConfig(): Promise<boolean> {
  for (let attempt = 1; attempt <= FEATURE_CHECK_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      FEATURE_CHECK_TIMEOUT_MS,
    );

    try {
      const response = await fetch(
        `${officeApiBase()}/api/config/features`,
        { signal: controller.signal },
      );
      if (!response.ok) {
        if (isRetryableStatus(response.status) && attempt < FEATURE_CHECK_ATTEMPTS) {
          if (import.meta.env.DEV) {
            console.warn('[Evaluation access]', {
              path: '/api/config/features',
              status: response.status,
              retry: attempt,
            });
          }
          await wait(400 * (2 ** (attempt - 1)));
          continue;
        }
        if (import.meta.env.DEV) {
          console.warn('[Evaluation access]', {
            path: '/api/config/features',
            status: response.status,
          });
        }
        throw new FeatureCheckError('Could not verify Evaluation Access availability. Try again shortly.');
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new FeatureCheckError('The API returned an invalid feature configuration.');
      }

      if (
        typeof payload !== 'object'
        || payload === null
        || !('enableEvaluationAccess' in payload)
        || typeof payload.enableEvaluationAccess !== 'boolean'
      ) {
        throw new FeatureCheckError('The API returned an invalid feature configuration.');
      }
      return payload.enableEvaluationAccess;
    } catch (error) {
      if (error instanceof FeatureCheckError) {
        throw error;
      }
      const timedOut = controller.signal.aborted;
      if (import.meta.env.DEV) {
        console.warn('[Evaluation access]', {
          path: '/api/config/features',
          issue: timedOut ? 'timeout' : 'network',
          retry: attempt,
        });
      }
      if (attempt === FEATURE_CHECK_ATTEMPTS) {
        throw new Error(timedOut
          ? 'Timed out checking demo availability. Check your connection, then retry.'
          : 'Could not connect to Evaluation Access. Check your connection, then retry.');
      }
      await wait(400 * (2 ** (attempt - 1)));
    } finally {
      window.clearTimeout(timeoutId);
    }
  }
  throw new Error('Could not verify Evaluation Access availability. Try again shortly.');
}

const sharedFeatureCheck = () => {
  if (cachedFeatureCheck && cachedFeatureCheck.expiresAt > Date.now()) {
    return Promise.resolve(cachedFeatureCheck.enabled);
  }
  if (inFlightCheck) return inFlightCheck;
  const pending = fetchFeatureConfig();
  inFlightCheck = pending;
  pending.then(
    (enabled) => {
      cachedFeatureCheck = { enabled, expiresAt: Date.now() + FEATURE_CHECK_CACHE_MS };
      if (inFlightCheck === pending) inFlightCheck = null;
    },
    () => { if (inFlightCheck === pending) inFlightCheck = null; },
  );
  return pending;
};

export function checkEvaluationAccess(signal?: AbortSignal): Promise<boolean> {
  const pending = sharedFeatureCheck();
  if (!signal) return pending;
  if (signal.aborted) {
    return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
  }

  return new Promise<boolean>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    pending.then(
      (enabled) => {
        signal.removeEventListener('abort', onAbort);
        resolve(enabled);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}
