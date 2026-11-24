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
      throw new Error(
        `Feature availability request failed (HTTP ${response.status}).`
      );
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
        'Timed out checking demo availability. Verify the API is running, then retry.'
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        'Could not connect to the Evaluation Access API. Check the API connection, then retry.'
      );
    }

    throw error;

  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}