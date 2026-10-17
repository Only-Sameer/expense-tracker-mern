import { env } from '../config/env.js';

// Origin validation is a defense-in-depth check for cookie-authenticated writes.
export function checkOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin || origin !== env.CLIENT_ORIGIN) {
    return res.status(403).json({ error: 'Request origin could not be verified.' });
  }
  next();
}
