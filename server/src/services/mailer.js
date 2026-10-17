import { env } from '../config/env.js';

export const emailEnabled = Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

/** Send through Resend's HTTPS API, keeping API credentials server-side. */
export async function sendTransactionalEmail({ to, subject, html }) {
  if (!emailEnabled) {
    const error = new Error('Email delivery is not configured for this deployment.');
    error.status = 503;
    throw error;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + env.RESEND_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html }),
  });
  if (!response.ok) {
    // Do not log the authorization header, token, or message body.
    console.error('Transactional email provider returned status', response.status);
    const error = new Error('Email delivery failed. Please try again later.');
    error.status = response.status >= 500 ? 503 : 502;
    throw error;
  }
}
