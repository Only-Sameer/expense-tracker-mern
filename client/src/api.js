const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const RETRYABLE_STATUS = new Set([502, 503, 504]);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const NO_REFRESH_PATHS = [
  '/auth/login', '/auth/signup', '/auth/google', '/auth/refresh',
  '/auth/password-reset', '/auth/password-reset/request',
  '/auth/verification-request', '/auth/verify-email',
];
const sleep = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds));
let refreshInFlight = null;

function announceWaking(active, message) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('budgetry:server-state', { detail: { active, message } }));
}
function isAuthEntry(path) {
  return NO_REFRESH_PATHS.some(suffix => path === suffix || path.startsWith(suffix + '/'));
}
async function rawFetch(path, options = {}) {
  return fetch(API_BASE + '/api' + path, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
}
async function refreshAccessSession() {
  // Serialize refreshes so two expired API requests in this tab do not rotate the same token concurrently.
  if (!refreshInFlight) {
    refreshInFlight = rawFetch('/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      .then(response => response.ok)
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

/**
 * Safe GETs retry common Render cold-start/network failures. Mutating requests are
 * not retried after network failures. A 401 may be retried once after refresh:
 * auth middleware rejects that request before its route handler can mutate data.
 */
export async function api(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const canRetry = SAFE_METHODS.has(method);
  const maxAttempts = canRetry ? 3 : 1;
  let lastNetworkError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      let response = await rawFetch(path, options);

      if (response.status === 401 && !isAuthEntry(path) && !options.__refreshRetried) {
        try {
          const refreshed = await refreshAccessSession();
          if (refreshed) {
            response = await rawFetch(path, { ...options, __refreshRetried: true });
          }
        } catch { /* Surface the original 401 when refresh itself cannot run. */ }
      }

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
        error.code = body.code;
        error.retryAfter = response.headers.get('Retry-After');
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
  const error = new Error('Budgetry could not reach the server after a few attempts. The service may be waking up—please retry.');
  error.cause = lastNetworkError;
  throw error;
}
export const json = data => JSON.stringify(data);
