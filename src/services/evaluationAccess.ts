import { officeApiBase } from './officeAuth';

const FEATURE_CHECK_TIMEOUT_MS = 90000;

export async function checkEvaluationAccess(signal?: AbortSignal): Promise<boolean> {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();

  signal?.addEventListener('abort', abortFromCaller, { once: true });

  if (signal?.aborted) controller.abort();

  const timeoutId = setTimeout(
    () => controller.abort(),
    FEATURE_CHECK_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      `${officeApiBase()}/api/config/features`,
      {
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      if (import.meta.env.DEV) {
        console.warn('[Evaluation access]', { path: '/api/config/features', status: response.status });
      }
      throw new Error('Could not verify Evaluation Access availability. Try again shortly.');
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new Error('The API returned an invalid feature configuration.');
    }

    if (
      typeof payload !== 'object'
      || payload === null
      || !('enableEvaluationAccess' in payload)
      || typeof payload.enableEvaluationAccess !== 'boolean'
    ) {
      throw new Error('The API returned an invalid feature configuration.');
    }

    return payload.enableEvaluationAccess;

  } catch (error) {

    if (signal?.aborted) throw error;

    if (controller.signal.aborted) {
      throw new Error(
        'Timed out checking demo availability. Check your connection, then retry.'
      );
    }

    if (error instanceof TypeError) {
      if (import.meta.env.DEV) {
        console.warn('[Evaluation access]', { path: '/api/config/features', issue: 'network' });
      }
      throw new Error(
        'Could not connect to Evaluation Access. Check your connection, then retry.'
      );
    }

    throw error;

  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}