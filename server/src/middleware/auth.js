import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { AUTH_COOKIE } from '../config/cookies.js';

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) return res.status(401).json({ error: 'Please sign in to continue.' });

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }

  try {
    const user = await User.findById(payload.sub).select('_id name email');
    if (!user) return res.status(401).json({ error: 'Session is no longer valid. Please sign in again.' });
    req.user = user;
    return next();
  } catch (error) {
    // Database errors are server failures, not authentication failures.
    return next(error);
  }
}
