import { env } from '../config/env.js';
import { isAdminEmail } from '../security/adminAccess.js';

/** Must be mounted after requireAuth. Authorization is enforced on the server. */
export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in to continue.' });
  if (!isAdminEmail(req.user.email, env.ADMIN_EMAILS)) {
    return res.status(403).json({ error: 'Administrator access is required.' });
  }
  return next();
}
