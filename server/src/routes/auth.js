import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { asyncHandler } from '../middleware/asyncHandler.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import Expense from '../models/Expense.js';
import AuthToken from '../models/AuthToken.js';
import RecurringExpense from '../models/RecurringExpense.js';
import { env } from '../config/env.js';
import { AUTH_COOKIE, cookieOptions, clearCookieOptions } from '../config/cookies.js';
import { requireAuth } from '../middleware/auth.js';
import { signupSchema, loginSchema } from '../validation/schemas.js';
import { isAdminEmail } from '../security/adminAccess.js';
import { emailEnabled, escapeHtml, sendTransactionalEmail } from '../services/mailer.js';

const router = Router();
const publicUser = user => ({
  id: user._id,
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified !== false,
  isAdmin: isAdminEmail(user.email, env.ADMIN_EMAILS),
});
const emailSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email()).transform(value => value.toLowerCase()),
});
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/i, 'This link is invalid or expired.');
const passwordSchema = z.string().min(10).max(128)
  .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be no more than 72 UTF-8 bytes for bcrypt.');
const passwordResetSchema = z.object({ token: tokenSchema, password: passwordSchema });
const hashToken = token => createHash('sha256').update(token).digest('hex');

function setSession(res, user) {
  const token = jwt.sign({
    sub: user._id.toString(),
    ver: Number(user.sessionVersion || 0),
  }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: env.JWT_EXPIRES_IN });
  res.cookie(AUTH_COOKIE, token, cookieOptions);
}

async function issueToken(user, purpose, ttlMs) {
  const rawToken = randomBytes(32).toString('hex');
  await AuthToken.deleteMany({ user: user._id, purpose });
  await AuthToken.create({
    user: user._id,
    purpose,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return rawToken;
}

async function sendVerification(user) {
  const token = await issueToken(user, 'verify-email', 24 * 60 * 60 * 1000);
  const url = env.CLIENT_ORIGIN + '/verify-email?token=' + encodeURIComponent(token);
  await sendTransactionalEmail({
    to: user.email,
    subject: 'Verify your Budgetry email',
    html: '<p>Hi ' + escapeHtml(user.name) + ',</p><p>Verify your email address to activate your Budgetry account.</p><p><a href="' + url + '">Verify email address</a></p><p>This link expires in 24 hours. If you did not create this account, you can ignore this message.</p>',
  });
}

async function sendPasswordReset(user) {
  const token = await issueToken(user, 'password-reset', 60 * 60 * 1000);
  const url = env.CLIENT_ORIGIN + '/reset-password?token=' + encodeURIComponent(token);
  await sendTransactionalEmail({
    to: user.email,
    subject: 'Reset your Budgetry password',
    html: '<p>Hi ' + escapeHtml(user.name) + ',</p><p>We received a request to reset your Budgetry password.</p><p><a href="' + url + '">Choose a new password</a></p><p>This link expires in one hour. If you did not request this, ignore this message; your password will not change.</p>',
  });
}

router.post('/signup', asyncHandler(async (req, res) => {
  const data = signupSchema.parse(req.body);
  const exists = await User.exists({ email: data.email });
  if (exists) return res.status(409).json({ error: 'An account with that email already exists.' });

  const user = await User.create({
    name: data.name,
    email: data.email,
    passwordHash: await bcrypt.hash(data.password, 12),
    emailVerified: !emailEnabled,
  });

  if (emailEnabled) {
    try {
      await sendVerification(user);
    } catch (error) {
      await AuthToken.deleteMany({ user: user._id });
      await User.deleteOne({ _id: user._id });
      throw error;
    }
    return res.status(201).json({
      verificationRequired: true,
      message: 'Account created. Check your inbox for a verification link before signing in.',
    });
  }

  // Existing deployments without a mail provider remain usable; enabling mail makes
  // verification mandatory for newly registered accounts.
  setSession(res, user);
  res.status(201).json({ user: publicUser(user) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);
  const user = await User.findOne({ email: data.email }).select('+passwordHash');
  // Same response for unknown email and wrong password reduces account enumeration.
  if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  if (emailEnabled && user.emailVerified === false) {
    return res.status(403).json({ error: 'Please verify your email before signing in.', code: 'EMAIL_NOT_VERIFIED' });
  }
  setSession(res, user);
  res.json({ user: publicUser(user) });
}));

router.post('/verification-request', asyncHandler(async (req, res) => {
  if (!emailEnabled) return res.status(503).json({ error: 'Email verification is unavailable until the deployment mail settings are configured.' });
  const { email } = emailSchema.parse(req.body);
  const user = await User.findOne({ email });
  // Use the same response even if no account exists or it is already verified.
  if (user && user.emailVerified === false) {
    try { await sendVerification(user); } catch { console.error('Verification email delivery failed.'); }
  }
  res.json({ message: 'If the account needs verification, a link has been sent.' });
}));

router.post('/verify-email', asyncHandler(async (req, res) => {
  if (!emailEnabled) return res.status(503).json({ error: 'Email verification is not configured for this deployment.' });
  const { token } = z.object({ token: tokenSchema }).parse(req.body);
  const record = await AuthToken.findOne({
    purpose: 'verify-email',
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });
  if (!record) return res.status(400).json({ error: 'This verification link is invalid or has expired.' });
  const user = await User.findById(record.user);
  if (!user) {
    await AuthToken.deleteMany({ _id: record._id });
    return res.status(400).json({ error: 'This verification link is invalid or has expired.' });
  }
  user.emailVerified = true;
  await user.save();
  await AuthToken.deleteMany({ user: user._id, purpose: 'verify-email' });
  setSession(res, user);
  res.json({ user: publicUser(user), message: 'Email verified successfully.' });
}));

router.post('/password-reset/request', asyncHandler(async (req, res) => {
  if (!emailEnabled) return res.status(503).json({ error: 'Password reset is unavailable until the deployment mail settings are configured.' });
  const { email } = emailSchema.parse(req.body);
  const user = await User.findOne({ email });
  // Never reveal whether an email address has a Budgetry account.
  if (user) {
    try { await sendPasswordReset(user); } catch { console.error('Password reset email delivery failed.'); }
  }
  res.json({ message: 'If an account exists for that address, a reset link has been sent.' });
}));

router.post('/password-reset', asyncHandler(async (req, res) => {
  if (!emailEnabled) return res.status(503).json({ error: 'Password reset is not configured for this deployment.' });
  const data = passwordResetSchema.parse(req.body);
  const record = await AuthToken.findOne({
    purpose: 'password-reset',
    tokenHash: hashToken(data.token),
    expiresAt: { $gt: new Date() },
  });
  if (!record) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  const user = await User.findById(record.user).select('+passwordHash');
  if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  user.passwordHash = await bcrypt.hash(data.password, 12);
  user.sessionVersion = Number(user.sessionVersion || 0) + 1;
  await user.save();
  await AuthToken.deleteMany({ user: user._id });
  res.json({ message: 'Password changed. Sign in with your new password.' });
}));

router.post('/logout', (req, res) => {
  res.clearCookie(AUTH_COOKIE, clearCookieOptions);
  res.status(204).end();
});
router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
router.get('/export', requireAuth, asyncHandler(async (req, res) => {
  const expenses = await Expense.find({ user: req.user._id }).sort({ date: -1 }).lean();
  res.json({
    exportedAt: new Date().toISOString(),
    user: publicUser(req.user),
    expenses: expenses.map(({ _id, amount, category, date, note, createdAt }) => ({ id: _id, amount, category, date, note, createdAt })),
  });
}));
router.delete('/account', requireAuth, asyncHandler(async (req, res) => {
  await AuthToken.deleteMany({ user: req.user._id });
  await RecurringExpense.deleteMany({ user: req.user._id });
  await Expense.deleteMany({ user: req.user._id });
  await User.deleteOne({ _id: req.user._id });
  res.clearCookie(AUTH_COOKIE, clearCookieOptions);
  res.status(204).end();
}));
export default router;
