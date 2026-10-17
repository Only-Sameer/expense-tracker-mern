const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const sleep = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds));

function announceWaking(active, message) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('budgetry:server-state', {
    detail: { active, message }
  }));
}

/**
 * Retry only safe requests. Mutating requests are never retried automatically,
 * because a timed-out POST may already have been saved on the server.
 */
export async function api(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const canRetry = SAFE_METHODS.has(method);
  const maxAttempts = canRetry ? 3 : 1;
  let lastNetworkError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(API_BASE + '/api' + path, {
        credentials: 'include',
        ...options,
        headers: {
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
      });

      if (canRetry && RETRYABLE_STATUS.has(response.status) && attempt < maxAttempts) {
        announceWaking(true, 'The service is starting. Retrying automatically…');
        await sleep(450 * (2 ** (attempt - 1)));
        continue;
      }

      announceWaking(false);
      if (response.status === 204) return null;
      const type = response.headers.get('content-type') || '';
      if (!response.ok) {
        const body = type.includes('application/json') ? await response.json() : {};
        const error = new Error(body.error || (
          RETRYABLE_STATUS.has(response.status)
            ? 'The server is starting slowly. Please try again in a moment.'
            : 'Request failed (' + response.status + ').'
        ));
        error.status = response.status;
        throw error;
      }
      if (type.includes('text/csv')) return response.blob();
      return response.json();
    } catch (error) {
      if (error?.status !== undefined) throw error;
      lastNetworkError = error;
      if (!canRetry || attempt >= maxAttempts) break;
      announceWaking(true, 'Waking up the server… This can take a little while on a free hosting plan.');
      await sleep(450 * (2 ** (attempt - 1)));
    }
  }

  announceWaking(false);
  const error = new Error(
    'Budgetry could not reach the server after a few attempts. The service may be waking up—please retry.'
  );
  error.cause = lastNetworkError;
  throw error;
}

export const json = data => JSON.stringify(data);
