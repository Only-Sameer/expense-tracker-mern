import { env } from './env.js';

export const AUTH_COOKIE = 'expense_auth';
export const cookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE === 'true',
  sameSite: env.COOKIE_SAME_SITE,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
export const clearCookieOptions = {
  httpOnly: true, secure: env.COOKIE_SECURE === 'true',
  sameSite: env.COOKIE_SAME_SITE, path: '/',
};
