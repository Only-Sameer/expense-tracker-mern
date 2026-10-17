const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}/api${path}`, {
    credentials: 'include',
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  if (response.status === 204) return null;
  const type = response.headers.get('content-type') || '';
  if (!response.ok) {
    const body = type.includes('application/json') ? await response.json() : {};
    throw new Error(body.error || `Request failed (${response.status}).`);
  }
  if (type.includes('text/csv')) return response.blob();
  return response.json();
}
export const json = data => JSON.stringify(data);
