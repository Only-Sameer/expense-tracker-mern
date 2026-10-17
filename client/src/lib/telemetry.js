const DSN = import.meta.env.VITE_SENTRY_DSN || '';
let installed = false;

function scrub(value) {
  return String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/https?:\/\/[^\s)]+/gi, match => {
      try { const url = new URL(match); return url.origin + url.pathname; } catch { return '[redacted-url]'; }
    })
    .slice(0, 2400);
}
function getEndpoint(dsn) {
  const url = new URL(dsn);
  const segments = url.pathname.split('/').filter(Boolean);
  const projectId = segments.pop();
  if (!projectId || !url.username) return null;
  const prefix = segments.length ? '/' + segments.join('/') : '';
  const endpoint = url.origin + prefix + '/api/' + projectId + '/envelope/';
  return endpoint + '?sentry_key=' + encodeURIComponent(url.username) + '&sentry_version=7&sentry_client=budgetry-web/1.0';
}
function eventId() {
  if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '');
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
}

/** Optional dependency-free Sentry envelope transport. Sends no account or expense data. */
export function captureException(error, context = {}) {
  if (!DSN || typeof fetch !== 'function') return;
  let endpoint;
  try { endpoint = getEndpoint(DSN); } catch { return; }
  if (!endpoint) return;
  const id = eventId();
  const message = scrub(error?.message || error || 'Unknown browser exception');
  const frames = String(error?.stack || context.componentStack || '').split('\n').slice(1, 30).map(line => ({ filename: scrub(line.trim()), function: 'browser' }));
  const event = {
    event_id: id, timestamp: Date.now() / 1000, platform: 'javascript', level: 'error',
    logger: 'budgetry', release: 'budgetry-web@1.0.0',
    request: { url: window.location.origin + window.location.pathname, method: 'BROWSER' },
    exception: { values: [{ type: scrub(error?.name || 'Error'), value: message, stacktrace: { frames } }] },
    tags: { component: context.component ? scrub(context.component) : 'global' },
  };
  const envelope = [
    JSON.stringify({ event_id: id, sent_at: new Date().toISOString(), dsn: DSN }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n') + '\n';
  fetch(endpoint, { method: 'POST', mode: 'cors', credentials: 'omit', keepalive: true, headers: { 'Content-Type': 'application/x-sentry-envelope' }, body: envelope })
    .catch(() => { /* Diagnostics must never break the UI. */ });
}
export function installGlobalErrorHandlers() {
  if (installed || !DSN || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', event => captureException(event.error || new Error(event.message || 'Uncaught browser error'), { component: 'window.error' }));
  window.addEventListener('unhandledrejection', event => captureException(event.reason instanceof Error ? event.reason : new Error('Unhandled promise rejection'), { component: 'window.unhandledrejection' }));
}
