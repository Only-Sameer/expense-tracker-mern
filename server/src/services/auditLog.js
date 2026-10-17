import AuditEvent from '../models/AuditEvent.js';

/**
 * Keep audit events about actions, not financial contents. Never persist passwords,
 * bearer tokens, refresh tokens, expense notes or CAPTCHA responses.
 */
export async function writeAuditEvent(req, { action, userId = req?.user?._id, success = true, metadata = {} } = {}) {
  try {
    await AuditEvent.create({
      user: userId || undefined,
      action: String(action || 'unknown').slice(0, 80),
      success: Boolean(success),
      ipAddress: String(req?.ip || '').slice(0, 80),
      userAgent: String(req?.get?.('user-agent') || '').slice(0, 300),
      metadata,
    });
  } catch (error) {
    // Audit failure should be visible, but it must not log private payloads or stop
    // ordinary CRUD. Production monitoring should alert on this operational signal.
    console.error('Budgetry audit event write failed:', error?.message || 'unknown error');
  }
}
