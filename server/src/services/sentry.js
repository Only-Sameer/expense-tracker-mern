import { env } from '../config/env.js';

function scrub(value) {
  return String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/(password|token|secret|authorization)=?[^&\s]*/gi, '$1=[redacted]')
    .slice(0, 2400);
}
function endpointFromDsn(dsn) {
  const url = new URL(dsn);
  const parts = url.pathname.split('/').filter(Boolean);
  const project = parts.pop();
  if (!project || !url.username) return null;
  const prefix = parts.length ? '/' + parts.join('/') : '';
  return url.origin + prefix + '/api/' + project + '/envelope/?sentry_key=' +
    encodeURIComponent(url.username) + '&sentry_version=7&sentry_client=budgetry-api/1.0';
}
function eventId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
}

/** Optional Sentry-compatible envelope transport, disabled while SENTRY_DSN is empty. */
export function captureServerException(error, req) {
  if (!env.SENTRY_DSN) return;
  let endpoint;
  try { endpoint = endpointFromDsn(env.SENTRY_DSN); } catch { return; }
  if (!endpoint) return;
  const id = eventId();
  const path = req ? req.protocol + '://' + req.get('host') + req.path : '';
  const event = {
    event_id: id, timestamp: Date.now() / 1000, platform: 'node',
    level: 'error', logger: 'budgetry-api', release: 'budgetry-api@1.0.0',
    exception: { values: [{ type: scrub(error?.name || 'Error'), value: scrub(error?.message || 'Unknown server error'), stacktrace: { frames: String(error?.stack || '').split('\n').slice(1, 30).map(line => ({ filename: scrub(line.trim()), function: 'server' })) } }] },
    request: { url: path, method: req?.method || '' },
    tags: { route: scrub(req?.route?.path || req?.path || 'unknown') },
  };
  const envelope = [
    JSON.stringify({ event_id: id, sent_at: new Date().toISOString(), dsn: env.SENTRY_DSN }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n') + '\n';
  fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-sentry-envelope' }, body: envelope, signal: AbortSignal.timeout(2500) })
    .catch(() => { /* Observability must not block the API response. */ });
}
