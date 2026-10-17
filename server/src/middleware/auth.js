import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { env } from '../config/env.js';
import { AUTH_COOKIE } from '../config/cookies.js';
import { emailEnabled } from '../services/mailer.js';

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
    // Reject legacy access tokens without a server-managed session ID; this forces
    // a one-time sign-in after the rotating-session release.
    if (!payload.sid) return res.status(401).json({ error: 'Your session needs to be renewed. Please sign in again.' });
    const now = new Date();
    const session = await Session.findOne({
      _id: payload.sid,
      user: payload.sub,
      revokedAt: null,
      expiresAt: { $gt: now },
    });
    if (!session) return res.status(401).json({ error: 'Your session is no longer valid. Please sign in again.' });

    const user = await User.findById(payload.sub).select('_id name email emailVerified sessionVersion googleId totpEnabled');
    if (!user) return res.status(401).json({ error: 'Session is no longer valid. Please sign in again.' });
    if (Number(payload.ver || 0) !== Number(user.sessionVersion || 0)) {
      return res.status(401).json({ error: 'Your session is no longer valid. Please sign in again.' });
    }
    if (emailEnabled && user.emailVerified === false) {
      return res.status(403).json({ error: 'Please verify your email before using Budgetry.', code: 'EMAIL_NOT_VERIFIED' });
    }
    // Avoid writing on every request; update the session's activity at most once per five minutes.
    if (!session.lastUsedAt || session.lastUsedAt.getTime() < now.getTime() - 5 * 60 * 1000) {
      await Session.updateOne({ _id: session._id, revokedAt: null }, { $set: { lastUsedAt: now } });
    }
    req.user = user;
    req.session = session;
    return next();
  } catch (error) {
    return next(error);
  }
}
