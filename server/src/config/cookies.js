import { env } from './env.js';

export const AUTH_COOKIE = 'expense_auth';
export const REFRESH_COOKIE = 'budgetry_refresh';
export const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000;
export const cookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE === 'true',
  sameSite: env.COOKIE_SAME_SITE,
  path: '/',
  maxAge: ACCESS_COOKIE_MAX_AGE,
};
export const refreshCookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE === 'true',
  sameSite: env.COOKIE_SAME_SITE,
  path: '/api/auth',
};
export const clearCookieOptions = {
  httpOnly: true, secure: env.COOKIE_SECURE === 'true',
  sameSite: env.COOKIE_SAME_SITE, path: '/',
};
export const clearRefreshCookieOptions = {
  httpOnly: true, secure: env.COOKIE_SECURE === 'true',
  sameSite: env.COOKIE_SAME_SITE, path: '/api/auth',
};
