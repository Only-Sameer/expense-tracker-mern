import { Router } from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import User from '../models/User.js';
import Expense from '../models/Expense.js';
import AuthToken from '../models/AuthToken.js';
import RecurringExpense from '../models/RecurringExpense.js';
import Session from '../models/Session.js';
import RefreshToken from '../models/RefreshToken.js';
import AuditEvent from '../models/AuditEvent.js';
import { env } from '../config/env.js';
import {
  AUTH_COOKIE, REFRESH_COOKIE, cookieOptions, refreshCookieOptions,
  clearCookieOptions, clearRefreshCookieOptions,
} from '../config/cookies.js';
import { requireAuth } from '../middleware/auth.js';
import { signupSchema, loginSchema, reauthSchema, twoFactorCodeSchema } from '../validation/schemas.js';
import { isAdminEmail } from '../security/adminAccess.js';
import { emailEnabled, escapeHtml, sendTransactionalEmail } from '../services/mailer.js';
import { verifyTurnstile } from '../services/turnstile.js';
import { incrementCounter, getCounter, setCounter, deleteCounter, privacyKey } from '../services/redisRest.js';
import { writeAuditEvent } from '../services/auditLog.js';
import { encryptTotpSecret, decryptTotpSecret, generateTotpSecret, totpCode, totpUri, verifyTotp } from '../security/totp.js';

const router = Router();
const ACCESS_MS = 15 * 60 * 1000;
const EMAIL_TOKEN_HOURS = 24;
const RESET_TOKEN_MS = 60 * 60 * 1000;
const hashToken = token => createHash('sha256').update(token).digest('hex');
const publicUser = user => ({
  id: user._id,
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified !== false,
  isAdmin: isAdminEmail(user.email, env.ADMIN_EMAILS),
  googleConnected: Boolean(user.googleId),
  twoFactorEnabled: Boolean(user.totpEnabled),
});
const emailSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email()).transform(value => value.toLowerCase()),
});
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/i, 'This link is invalid or expired.');
const passwordSchema = z.string().min(10).max(128)
  .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be no more than 72 UTF-8 bytes for bcrypt.');
const passwordResetSchema = z.object({ token: tokenSchema, password: passwordSchema });

const identityKey = (email, ip) => 'auth:fail:' + privacyKey(String(email || '').toLowerCase()) + ':' + privacyKey(ip || 'unknown');
const lockKey = (email, ip) => 'auth:lock:' + privacyKey(String(email || '').toLowerCase()) + ':' + privacyKey(ip || 'unknown');

async function recordLoginFailure(email, ip) {
  const count = await incrementCounter(identityKey(email, ip), 15 * 60);
  if (count >= 5) {
    // Exponential lockouts: 30s, 60s, 120s … capped at 30 minutes.
    const seconds = Math.min(30 * (2 ** Math.min(count - 5, 6)), 30 * 60);
    await setCounter(lockKey(email, ip), 'locked', seconds);
  }
  return count;
}
async function clearLoginFailures(email, ip) {
  await Promise.all([deleteCounter(identityKey(email, ip)), deleteCounter(lockKey(email, ip))]);
}
function refreshLifetime(keepSignedIn) {
  return keepSignedIn
    ? env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
    : env.REFRESH_TOKEN_SHORT_HOURS * 60 * 60 * 1000;
}
function clearSessionCookies(res) {
  res.clearCookie(AUTH_COOKIE, clearCookieOptions);
  res.clearCookie(REFRESH_COOKIE, clearRefreshCookieOptions);
}
function signAccessToken(user, sessionId) {
  return jwt.sign({
    sub: user._id.toString(),
    sid: sessionId.toString(),
    ver: Number(user.sessionVersion || 0),
  }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: env.ACCESS_TOKEN_TTL });
}
async function setSession(res, user, req, keepSignedIn = true) {
  const now = new Date();
  const sessionId = new mongoose.Types.ObjectId();
  const familyId = randomUUID();
  const rawRefresh = randomBytes(48).toString('hex');
  const rawHash = hashToken(rawRefresh);
  const ttl = refreshLifetime(keepSignedIn);
  const expiresAt = new Date(now.getTime() + ttl);
  const session = await Session.create({
    _id: sessionId,
    user: user._id,
    familyId,
    currentRefreshHash: rawHash,
    keepSignedIn,
    userAgent: String(req?.get?.('user-agent') || '').slice(0, 300),
    ipAddress: String(req?.ip || '').slice(0, 80),
    lastUsedAt: now,
    expiresAt,
    recentAuthAt: now,
  });
  try {
    await RefreshToken.create({
      user: user._id, session: session._id, familyId, tokenHash: rawHash,
      status: 'active', expiresAt,
    });
  } catch (error) {
    await Session.deleteOne({ _id: session._id });
    throw error;
  }
  const access = signAccessToken(user, session._id);
  res.cookie(AUTH_COOKIE, access, { ...cookieOptions, maxAge: ACCESS_MS });
  res.cookie(REFRESH_COOKIE, rawRefresh, { ...refreshCookieOptions, maxAge: ttl });
  return session;
}

async function revokeFamily(familyId, reason = 'revoked') {
  const now = new Date();
  await Promise.all([
    Session.updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: now } }),
    RefreshToken.updateMany({ familyId, status: 'active' }, { $set: { status: 'revoked' } }),
  ]);
  return reason;
}
async function revokeOneSession(session) {
  if (!session) return;
  await Promise.all([
    Session.updateOne({ _id: session._id, revokedAt: null }, { $set: { revokedAt: new Date() } }),
    RefreshToken.updateMany({ session: session._id, status: 'active' }, { $set: { status: 'revoked' } }),
  ]);
}
async function revokeAllUserSessions(userId) {
  const sessions = await Session.find({ user: userId, revokedAt: null }).select('familyId').lean();
  await Promise.all([
    Session.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: new Date() } }),
    RefreshToken.updateMany({ user: userId, status: 'active' }, { $set: { status: 'revoked' } }),
  ]);
  return sessions.length;
}

async function issueToken(user, purpose, ttlMs) {
  const rawToken = randomBytes(32).toString('hex');
  await AuthToken.deleteMany({ user: user._id, purpose });
  await AuthToken.create({
    user: user._id, purpose, tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return rawToken;
}
async function sendVerification(user) {
  const token = await issueToken(user, 'verify-email', EMAIL_TOKEN_HOURS * 60 * 60 * 1000);
  const url = env.CLIENT_ORIGIN + '/verify-email?token=' + encodeURIComponent(token);
  await sendTransactionalEmail({
    to: user.email, subject: 'Verify your Budgetry email',
    html: '<p>Hi ' + escapeHtml(user.name) + ',</p><p>Verify your email address to activate your Budgetry account.</p><p><a href="' + url + '">Verify email address</a></p><p>This link expires in 24 hours. If you did not create this account, you can ignore this message.</p>',
  });
}
async function sendPasswordReset(user) {
  const token = await issueToken(user, 'password-reset', RESET_TOKEN_MS);
  const url = env.CLIENT_ORIGIN + '/reset-password?token=' + encodeURIComponent(token);
  await sendTransactionalEmail({
    to: user.email, subject: 'Reset your Budgetry password',
    html: '<p>Hi ' + escapeHtml(user.name) + ',</p><p>We received a request to reset your Budgetry password.</p><p><a href="' + url + '">Choose a new password</a></p><p>This link expires in one hour. If you did not request this, ignore this message; your password will not change.</p>',
  });
}

async function requireTurnstile(token, req, res) {
  if (!env.TURNSTILE_SECRET_KEY) return true; // Disabled until both public/private keys are configured.
  const verification = await verifyTurnstile(token, req.ip);
  if (verification.success) return true;
  res.status(400).json({ error: 'Complete the security check and try again.', code: 'CAPTCHA_REQUIRED' });
  return false;
}

async function verifyGoogleCredential(credential) {
  if (!env.GOOGLE_CLIENT_ID) {
    const error = new Error('Google sign-in is not configured for this deployment.');
    error.status = 503;
    throw error;
  }
  if (typeof credential !== 'string' || credential.length < 20 || credential.length > 10000) {
    const error = new Error('Google sign-in could not be verified.');
    error.status = 401;
    throw error;
  }
  let response;
  try {
    response = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential), {
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    const error = new Error('Google sign-in is temporarily unavailable. Try again.');
    error.status = 503;
    throw error;
  }
  if (!response.ok) {
    const error = new Error('Google sign-in could not be verified.');
    error.status = 401;
    throw error;
  }
  const data = await response.json();
  if (data.aud !== env.GOOGLE_CLIENT_ID || data.email_verified !== 'true' || !data.sub || !data.email) {
    const error = new Error('Google sign-in could not be verified.');
    error.status = 401;
    throw error;
  }
  return {
    googleId: String(data.sub),
    email: String(data.email).toLowerCase(),
    name: String(data.name || data.given_name || 'Budgetry user').trim().slice(0, 80),
  };
}

async function verifyReauth(req, { password, googleCredential, totpCode } = {}) {
  const user = await User.findById(req.user._id).select('+passwordHash +totpSecretEncrypted');
  if (!user) return false;
  let providerVerified = false;
  if (googleCredential && user.googleId) {
    try {
      const google = await verifyGoogleCredential(googleCredential);
      providerVerified = google.googleId === user.googleId && google.email === user.email;
    } catch { providerVerified = false; }
  }
  const passwordVerified = typeof password === 'string' && password.length > 0 && await bcrypt.compare(password, user.passwordHash);
  let totpVerified = false;
  if (user.totpEnabled && totpCode && user.totpSecretEncrypted) {
    try { totpVerified = verifyTotp(decryptTotpSecret(user.totpSecretEncrypted), totpCode); } catch { totpVerified = false; }
  }
  if ((passwordVerified || providerVerified) && (!user.totpEnabled || totpVerified)) {
    await Session.updateOne({ _id: req.session._id, revokedAt: null }, { $set: { recentAuthAt: new Date() } });
    req.session.recentAuthAt = new Date();
    return true;
  }
  return false;
}

router.post('/signup', asyncHandler(async (req, res) => {
  const data = signupSchema.parse(req.body);
  if (!(await requireTurnstile(data.turnstileToken, req, res))) return;
  const exists = await User.exists({ email: data.email });
  if (exists) {
    await writeAuditEvent(req, { action: 'signup', success: false, metadata: { reason: 'duplicate-email' } });
    return res.status(400).json({ error: 'Unable to create an account with those details.' });
  }

  const user = await User.create({
    name: data.name, email: data.email, passwordHash: await bcrypt.hash(data.password, 12),
    emailVerified: !emailEnabled,
  });
  await writeAuditEvent(req, { action: 'signup', userId: user._id, success: true });
  if (emailEnabled) {
    try { await sendVerification(user); }
    catch (error) {
      await AuthToken.deleteMany({ user: user._id });
      await User.deleteOne({ _id: user._id });
      throw error;
    }
    return res.status(201).json({
      verificationRequired: true,
      message: 'Account created. Check your inbox for a verification link before signing in.',
    });
  }
  await setSession(res, user, req, true);
  res.status(201).json({ user: publicUser(user) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);
  const ip = req.ip || 'unknown';
  const lock = await getCounter(lockKey(data.email, ip));
  if (lock) {
    await writeAuditEvent(req, { action: 'login-locked', success: false });
    return res.status(429).json({ error: 'Sign-in is temporarily unavailable. Wait a little and try again.' });
  }
  const failures = Number(await getCounter(identityKey(data.email, ip)) || 0);
  if (failures >= 3 && env.TURNSTILE_SECRET_KEY) {
    if (!(await requireTurnstile(data.turnstileToken, req, res))) return;
  }

  const user = await User.findOne({ email: data.email }).select('+passwordHash +totpSecretEncrypted');
  const passwordMatches = user ? await bcrypt.compare(data.password, user.passwordHash) : false;
  if (!user || !passwordMatches) {
    const count = await recordLoginFailure(data.email, ip);
    await writeAuditEvent(req, { action: 'login', success: false, metadata: { failureCount: Math.min(count, 10) } });
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  if (emailEnabled && user.emailVerified === false) {
    return res.status(403).json({ error: 'Please verify your email before signing in.', code: 'EMAIL_NOT_VERIFIED' });
  }
  if (user.totpEnabled) {
    const secret = user.totpSecretEncrypted ? decryptTotpSecret(user.totpSecretEncrypted) : '';
    if (!secret || !verifyTotp(secret, data.totpCode)) {
      return res.status(428).json({ error: 'Enter the six-digit code from your authenticator app.', code: 'TOTP_REQUIRED' });
    }
  }

  await clearLoginFailures(data.email, ip);
  user.lastLoginAt = new Date();
  await user.save();
  await setSession(res, user, req, data.keepSignedIn);
  await writeAuditEvent(req, { action: 'login', userId: user._id, success: true });
  res.json({ user: publicUser(user) });
}));

router.post('/google', asyncHandler(async (req, res) => {
  const data = z.object({
    credential: z.string().min(20).max(10000),
    keepSignedIn: z.boolean().optional().default(true),
    totpCode: z.string().regex(/^\d{6}$/).optional(),
  }).parse(req.body);
  const identity = await verifyGoogleCredential(data.credential);
  let user = await User.findOne({ $or: [{ googleId: identity.googleId }, { email: identity.email }] }).select('+passwordHash +totpSecretEncrypted');
  if (!user) {
    user = await User.create({
      name: identity.name || identity.email.split('@')[0],
      email: identity.email,
      googleId: identity.googleId,
      // OAuth-only accounts still use the common required field; the random secret
      // is never disclosed and cannot be used as a practical password.
      passwordHash: await bcrypt.hash(randomBytes(48).toString('hex'), 12),
      emailVerified: true,
    });
  } else {
    if (user.googleId && user.googleId !== identity.googleId) {
      await writeAuditEvent(req, { action: 'google-login', userId: user._id, success: false });
      return res.status(401).json({ error: 'Google sign-in could not be verified.' });
    }
    if (!user.googleId && user.email === identity.email) {
      user.googleId = identity.googleId;
      user.emailVerified = true;
      await user.save();
    }
  }
  if (emailEnabled && user.emailVerified === false) {
    return res.status(403).json({ error: 'Please verify your email before signing in.', code: 'EMAIL_NOT_VERIFIED' });
  }
  if (user.totpEnabled) {
    const secret = user.totpSecretEncrypted ? decryptTotpSecret(user.totpSecretEncrypted) : '';
    if (!secret || !verifyTotp(secret, data.totpCode)) {
      return res.status(428).json({ error: 'Enter the six-digit authenticator code to finish sign-in.', code: 'TOTP_REQUIRED' });
    }
  }
  user.lastLoginAt = new Date();
  await user.save();
  await setSession(res, user, req, data.keepSignedIn);
  await writeAuditEvent(req, { action: 'google-login', userId: user._id, success: true });
  res.json({ user: publicUser(user) });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) {
    clearSessionCookies(res);
    return res.status(401).json({ error: 'Please sign in to continue.' });
  }
  const tokenHash = hashToken(raw);
  const token = await RefreshToken.findOne({ tokenHash });
  if (!token) {
    clearSessionCookies(res);
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
  if (token.status === 'used') {
    // Reuse of a rotated refresh token is a high-signal theft event: invalidate
    // every session and active refresh token sharing this family ID.
    await revokeFamily(token.familyId, 'refresh-token-reuse');
    await writeAuditEvent(req, { action: 'refresh-token-reuse', userId: token.user, success: false });
    clearSessionCookies(res);
    return res.status(401).json({ error: 'For your security, please sign in again.', code: 'REFRESH_REUSE' });
  }
  if (token.status !== 'active' || token.expiresAt <= new Date()) {
    clearSessionCookies(res);
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
  const now = new Date();
  const nextRaw = randomBytes(48).toString('hex');
  const nextHash = hashToken(nextRaw);
  const consumed = await RefreshToken.findOneAndUpdate(
    { _id: token._id, status: 'active', expiresAt: { $gt: now } },
    { $set: { status: 'used', usedAt: now, replacedByHash: nextHash } },
    { new: true },
  );
  if (!consumed) {
    const latest = await RefreshToken.findById(token._id);
    if (latest?.status === 'used') {
      await revokeFamily(token.familyId, 'refresh-token-reuse');
      await writeAuditEvent(req, { action: 'refresh-token-reuse', userId: token.user, success: false });
    }
    clearSessionCookies(res);
    return res.status(401).json({ error: 'Your session could not be renewed. Please sign in again.' });
  }

  const oldSession = await Session.findOne({ _id: token.session, user: token.user, revokedAt: null, expiresAt: { $gt: now } });
  if (!oldSession) {
    await RefreshToken.updateOne({ tokenHash: nextHash }, { $set: { status: 'revoked' } });
    clearSessionCookies(res);
    return res.status(401).json({ error: 'Your session is no longer valid. Please sign in again.' });
  }
  const ttl = refreshLifetime(oldSession.keepSignedIn);
  const expiresAt = new Date(now.getTime() + ttl);
  await RefreshToken.create({
    user: token.user, session: oldSession._id, familyId: token.familyId,
    tokenHash: nextHash, status: 'active', expiresAt,
  });
  const updatedSession = await Session.findOneAndUpdate(
    { _id: oldSession._id, user: token.user, revokedAt: null },
    { $set: { currentRefreshHash: nextHash, expiresAt, lastUsedAt: now } },
    { new: true },
  );
  if (!updatedSession) {
    await RefreshToken.updateOne({ tokenHash: nextHash }, { $set: { status: 'revoked' } });
    clearSessionCookies(res);
    return res.status(401).json({ error: 'Your session is no longer valid. Please sign in again.' });
  }
  const user = await User.findById(token.user).select('_id name email emailVerified sessionVersion googleId totpEnabled');
  if (!user || (emailEnabled && user.emailVerified === false)) {
    await revokeOneSession(updatedSession);
    clearSessionCookies(res);
    return res.status(401).json({ error: 'Your session is no longer valid. Please sign in again.' });
  }
  res.cookie(AUTH_COOKIE, signAccessToken(user, updatedSession._id), { ...cookieOptions, maxAge: ACCESS_MS });
  res.cookie(REFRESH_COOKIE, nextRaw, { ...refreshCookieOptions, maxAge: ttl });
  res.json({ user: publicUser(user) });
}));

router.post('/verification-request', asyncHandler(async (req, res) => {
  if (!emailEnabled) return res.status(503).json({ error: 'Email verification is unavailable until the deployment mail settings are configured.' });
  const { email } = emailSchema.parse(req.body);
  const user = await User.findOne({ email });
  if (user && user.emailVerified === false) {
    try { await sendVerification(user); } catch { console.error('Verification email delivery failed.'); }
  }
  res.json({ message: 'If the account needs verification, a link has been sent.' });
}));
router.post('/verify-email', asyncHandler(async (req, res) => {
  if (!emailEnabled) return res.status(503).json({ error: 'Email verification is not configured for this deployment.' });
  const { token } = z.object({ token: tokenSchema }).parse(req.body);
  const record = await AuthToken.findOne({ purpose: 'verify-email', tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!record) return res.status(400).json({ error: 'This verification link is invalid or has expired.' });
  const user = await User.findById(record.user).select('+passwordHash');
  if (!user) return res.status(400).json({ error: 'This verification link is invalid or has expired.' });
  user.emailVerified = true;
  await user.save();
  await AuthToken.deleteMany({ user: user._id, purpose: 'verify-email' });
  await setSession(res, user, req, true);
  await writeAuditEvent(req, { action: 'email-verified', userId: user._id, success: true });
  res.json({ user: publicUser(user), message: 'Email verified successfully.' });
}));

router.post('/password-reset/request', asyncHandler(async (req, res) => {
  if (!emailEnabled) return res.status(503).json({ error: 'Password reset is unavailable until the deployment mail settings are configured.' });
  const { email } = emailSchema.parse(req.body);
  const user = await User.findOne({ email });
  if (user) {
    try { await sendPasswordReset(user); } catch { console.error('Password reset email delivery failed.'); }
  }
  res.json({ message: 'If an account exists for that address, a reset link has been sent.' });
}));
router.post('/password-reset', asyncHandler(async (req, res) => {
  if (!emailEnabled) return res.status(503).json({ error: 'Password reset is not configured for this deployment.' });
  const data = passwordResetSchema.parse(req.body);
  const record = await AuthToken.findOne({ purpose: 'password-reset', tokenHash: hashToken(data.token), expiresAt: { $gt: new Date() } });
  if (!record) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  const user = await User.findById(record.user).select('+passwordHash');
  if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  user.passwordHash = await bcrypt.hash(data.password, 12);
  user.sessionVersion = Number(user.sessionVersion || 0) + 1;
  await user.save();
  await revokeAllUserSessions(user._id);
  await AuthToken.deleteMany({ user: user._id });
  await writeAuditEvent(req, { action: 'password-reset', userId: user._id, success: true });
  clearSessionCookies(res);
  res.json({ message: 'Password changed. Sign in with your new password.' });
}));

router.post('/reauth', requireAuth, asyncHandler(async (req, res) => {
  const data = reauthSchema.parse(req.body);
  if (!(await verifyReauth(req, data))) {
    await writeAuditEvent(req, { action: 'reauth', success: false });
    return res.status(401).json({ error: 'Re-authentication failed. Check your password or identity provider and try again.' });
  }
  await writeAuditEvent(req, { action: 'reauth', success: true });
  res.json({ message: 'Identity confirmed for five minutes.' });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  let session = null;
  const rawRefresh = req.cookies?.[REFRESH_COOKIE];
  if (rawRefresh) {
    const token = await RefreshToken.findOne({ tokenHash: hashToken(rawRefresh) });
    if (token) session = await Session.findById(token.session);
  }
  if (!session && req.cookies?.[AUTH_COOKIE]) {
    try {
      const payload = jwt.verify(req.cookies[AUTH_COOKIE], env.JWT_SECRET, { algorithms: ['HS256'], ignoreExpiration: true });
      if (payload.sid) session = await Session.findById(payload.sid);
    } catch { /* Always clear cookies even if an access token is malformed. */ }
  }
  if (session) await revokeOneSession(session);
  clearSessionCookies(res);
  if (session) await writeAuditEvent(req, { action: 'logout', userId: session.user, success: true });
  res.status(204).end();
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
router.get('/sessions', requireAuth, asyncHandler(async (req, res) => {
  const sessions = await Session.find({ user: req.user._id, revokedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ lastUsedAt: -1 }).limit(50).select('_id userAgent ipAddress createdAt lastUsedAt expiresAt keepSignedIn').lean();
  res.json({ sessions: sessions.map(s => ({
    id: String(s._id), current: String(s._id) === String(req.session._id),
    userAgent: s.userAgent || 'Unknown browser', ipAddress: s.ipAddress || '',
    createdAt: s.createdAt, lastUsedAt: s.lastUsedAt, expiresAt: s.expiresAt,
    keepSignedIn: Boolean(s.keepSignedIn),
  })) });
}));
router.delete('/sessions/:id', requireAuth, asyncHandler(async (req, res) => {
  const session = await Session.findOne({ _id: req.params.id, user: req.user._id, revokedAt: null });
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  await revokeOneSession(session);
  await writeAuditEvent(req, { action: 'session-revoked', success: true, metadata: { current: String(session._id) === String(req.session._id) } });
  if (String(session._id) === String(req.session._id)) clearSessionCookies(res);
  res.status(204).end();
}));
router.post('/logout-all', requireAuth, asyncHandler(async (req, res) => {
  await revokeAllUserSessions(req.user._id);
  await User.updateOne({ _id: req.user._id }, { $inc: { sessionVersion: 1 } });
  await writeAuditEvent(req, { action: 'logout-all', success: true });
  clearSessionCookies(res);
  res.status(204).end();
}));

router.post('/2fa/setup', requireAuth, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash +totpSecretEncrypted');
  const recentlyVerified = req.session.recentAuthAt && Date.now() - new Date(req.session.recentAuthAt).getTime() < 5 * 60 * 1000;
  if (!recentlyVerified) return res.status(428).json({ error: 'Confirm your password before changing two-factor settings.', code: 'REAUTH_REQUIRED' });
  if (user.totpEnabled) return res.status(409).json({ error: 'Authenticator sign-in is already enabled.' });
  const secret = generateTotpSecret();
  user.totpSecretEncrypted = encryptTotpSecret(secret);
  user.totpSetupAt = new Date();
  await user.save();
  res.json({ secret, otpauthUrl: totpUri(secret, user.email) });
}));
router.post('/2fa/enable', requireAuth, asyncHandler(async (req, res) => {
  const { code } = twoFactorCodeSchema.parse(req.body);
  const user = await User.findById(req.user._id).select('+totpSecretEncrypted');
  if (!user?.totpSecretEncrypted) return res.status(400).json({ error: 'Start authenticator setup first.' });
  if (!verifyTotp(decryptTotpSecret(user.totpSecretEncrypted), code)) return res.status(400).json({ error: 'That code is not valid. Check your authenticator app and try again.' });
  user.totpEnabled = true;
  user.totpSetupAt = null;
  await user.save();
  await writeAuditEvent(req, { action: 'two-factor-enabled', success: true });
  res.json({ user: publicUser(user), message: 'Two-factor authentication enabled.' });
}));
router.post('/2fa/disable', requireAuth, asyncHandler(async (req, res) => {
  const data = z.object({ password: z.string().min(1).max(128), code: z.string().regex(/^\d{6}$/) }).parse(req.body);
  const user = await User.findById(req.user._id).select('+passwordHash +totpSecretEncrypted');
  const validPassword = await bcrypt.compare(data.password, user.passwordHash);
  const validCode = user.totpEnabled && user.totpSecretEncrypted && verifyTotp(decryptTotpSecret(user.totpSecretEncrypted), data.code);
  if (!validPassword || !validCode) return res.status(401).json({ error: 'Password or authenticator code is incorrect.' });
  user.totpEnabled = false; user.totpSecretEncrypted = ''; user.totpSetupAt = null;
  await user.save();
  await writeAuditEvent(req, { action: 'two-factor-disabled', success: true });
  res.json({ user: publicUser(user), message: 'Two-factor authentication disabled.' });
}));

router.get('/audit', requireAuth, asyncHandler(async (req, res) => {
  const events = await AuditEvent.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50)
    .select('action success ipAddress userAgent createdAt metadata').lean();
  res.json({ events });
}));

router.get('/export', requireAuth, asyncHandler(async (req, res) => {
  const expenses = await Expense.find({ user: req.user._id }).sort({ date: -1 }).lean();
  const recurring = await RecurringExpense.find({ user: req.user._id }).sort({ dueDay: 1 }).lean();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    exportedAt: new Date().toISOString(),
    user: publicUser(req.user),
    expenses: expenses.map(({ _id, amount, category, date, note, tags = [], createdAt }) => ({ id: _id, amount, category, date, note, tags, createdAt })),
    recurringExpenses: recurring.map(({ _id, name, amount, category, dueDay, isActive, createdAt }) => ({ id: _id, name, amount, category, dueDay, isActive, createdAt })),
  });
}));

router.delete('/account', requireAuth, asyncHandler(async (req, res) => {
  const data = z.object({ password: z.string().min(1).max(128).optional(), googleCredential: z.string().max(10000).optional(), totpCode: z.string().regex(/^\d{6}$/).optional() }).parse(req.body || {});
  const user = await User.findById(req.user._id).select('+passwordHash');
  let verified = false;
  if (!user.googleId) {
    verified = Boolean(data.password && await bcrypt.compare(data.password, user.passwordHash));
  } else {
    verified = Boolean(req.session.recentAuthAt && Date.now() - new Date(req.session.recentAuthAt).getTime() < 5 * 60 * 1000);
  }
  if (user.googleId && data.googleCredential) {
    try { const google = await verifyGoogleCredential(data.googleCredential); verified = google.googleId === user.googleId && google.email === user.email; } catch { verified = false; }
  }
  if (user.totpEnabled) {
    const freshUser = await User.findById(user._id).select('+totpSecretEncrypted');
    try { verified = Boolean(verified && data.totpCode && verifyTotp(decryptTotpSecret(freshUser.totpSecretEncrypted), data.totpCode)); } catch { verified = false; }
  }
  if (!verified) return res.status(428).json({ error: 'Confirm your password or sign in again before deleting your account.', code: 'REAUTH_REQUIRED' });

  await writeAuditEvent(req, { action: 'account-deleted', userId: req.user._id, success: true });
  await revokeAllUserSessions(req.user._id);
  await RefreshToken.deleteMany({ user: req.user._id });
  await Session.deleteMany({ user: req.user._id });
  await AuthToken.deleteMany({ user: req.user._id });
  await RecurringExpense.deleteMany({ user: req.user._id });
  await Expense.deleteMany({ user: req.user._id });
  await User.deleteOne({ _id: req.user._id });
  clearSessionCookies(res);
  res.status(204).end();
}));

export default router;
