import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Expense from '../models/Expense.js';
import { env } from '../config/env.js';
import { AUTH_COOKIE, cookieOptions, clearCookieOptions } from '../config/cookies.js';
import { requireAuth } from '../middleware/auth.js';
import { signupSchema, loginSchema } from '../validation/schemas.js';

const router = Router();
const publicUser = user => ({ id: user._id, name: user.name, email: user.email });
function setSession(res, user) {
  const token = jwt.sign({ sub: user._id.toString() }, env.JWT_SECRET, {
    algorithm: 'HS256', expiresIn: env.JWT_EXPIRES_IN,
  });
  res.cookie(AUTH_COOKIE, token, cookieOptions);
}
router.post('/signup', asyncHandler(async (req, res) => {
  const data = signupSchema.parse(req.body);
  const exists = await User.exists({ email: data.email });
  if (exists) return res.status(409).json({ error: 'An account with that email already exists.' });
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await User.create({ name: data.name, email: data.email, passwordHash });
  setSession(res, user);
  res.status(201).json({ user: publicUser(user) });
}));
router.post('/login', asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);
  const user = await User.findOne({ email: data.email }).select('+passwordHash');
  // Same error for unknown email and wrong password to reduce account enumeration.
  if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  setSession(res, user);
  res.json({ user: publicUser(user) });
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
  await Expense.deleteMany({ user: req.user._id });
  await User.deleteOne({ _id: req.user._id });
  res.clearCookie(AUTH_COOKIE, clearCookieOptions);
  res.status(204).end();
}));
export default router;
