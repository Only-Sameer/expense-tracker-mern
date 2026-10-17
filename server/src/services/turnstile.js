import { env } from '../config/env.js';

/** Verify Cloudflare Turnstile tokens server-side; never trust a browser token alone. */
export async function verifyTurnstile(token, remoteIp) {
  if (!env.TURNSTILE_SECRET_KEY) return { configured: false, success: true };
  if (typeof token !== 'string' || token.length < 10 || token.length > 2048) {
    return { configured: true, success: false };
  }
  try {
    const body = new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: token,
      ...(remoteIp ? { remoteip: remoteIp } : {}),
    });
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { configured: true, success: false };
    const result = await response.json();
    return {
      configured: true,
      success: result.success === true,
      hostname: result.hostname || '',
      action: result.action || '',
    };
  } catch {
    // Fail closed when a configured bot-check provider is unreachable.
    return { configured: true, success: false };
  }
}
