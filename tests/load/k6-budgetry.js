import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Run after warming the service once with /health:
 * BUDGETRY_API_URL=https://... BUDGETRY_EMAIL=... BUDGETRY_PASSWORD=... k6 run tests/load/k6-budgetry.js
 * Don't use a real high-value account; use a dedicated staging test account.
 */
const BASE = (__ENV.BUDGETRY_API_URL || 'http://localhost:8080').replace(/\/+$/, '');
const EMAIL = __ENV.BUDGETRY_EMAIL || '';
const PASSWORD = __ENV.BUDGETRY_PASSWORD || '';

export const options = {
  scenarios: {
    authenticated_read_load: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 10),
      duration: __ENV.DURATION || '1m',
      gracefulStop: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1200', 'p(99)<2500'],
  },
};

export function setup() {
  const health = http.get(BASE + '/health', { tags: { name: 'health' } });
  check(health, { 'health endpoint ready': response => response.status === 200 });

  if (!EMAIL || !PASSWORD) {
    throw new Error('Set BUDGETRY_EMAIL and BUDGETRY_PASSWORD for a dedicated staging account.');
  }
  const login = http.post(
    BASE + '/api/auth/login',
    JSON.stringify({ email: EMAIL, password: PASSWORD, keepSignedIn: false }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } },
  );
  check(login, { 'staging account login succeeds': response => response.status === 200 });
  if (login.status !== 200) {
    throw new Error('Login failed; verify staging credentials and environment config without printing the password.');
  }
  const access = login.cookies.expense_auth?.[0]?.value;
  const refresh = login.cookies.budgetry_refresh?.[0]?.value;
  if (!access) throw new Error('Login succeeded but the access cookie was not returned.');
  return { access, refresh: refresh || '' };
}

export default function (session) {
  const cookie = 'expense_auth=' + session.access +
    (session.refresh ? '; budgetry_refresh=' + session.refresh : '');
  const params = { headers: { Cookie: cookie }, tags: { scenario: 'authenticated_read' } };

  const me = http.get(BASE + '/api/auth/me', { ...params, tags: { name: 'auth_me', scenario: 'authenticated_read' } });
  check(me, { 'session accepted': response => response.status === 200 });

  const expenses = http.get(BASE + '/api/expenses?page=1&limit=20&sort=date_desc', {
    ...params, tags: { name: 'expenses_page', scenario: 'authenticated_read' },
  });
  check(expenses, { 'expenses query paginates': response => response.status === 200 });

  const year = new Date().getFullYear();
  const summary = http.get(BASE + '/api/expenses/summary/monthly?year=' + year, {
    ...params, tags: { name: 'monthly_summary', scenario: 'authenticated_read' },
  });
  check(summary, { 'monthly aggregate succeeds': response => response.status === 200 });
  sleep(0.3);
}
