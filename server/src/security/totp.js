import { createCipheriv, createDecipheriv, createHmac, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const encryptionKey = () => createHash('sha256').update((env.TOTP_ENCRYPTION_KEY || env.JWT_SECRET) + ':budgetry-totp-v1').digest();

export function generateTotpSecret() {
  const bytes = randomBytes(20);
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let i = 0; i < bits.length; i += 5) output += BASE32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return output;
}
function decodeBase32(value) {
  const clean = String(value || '').toUpperCase().replace(/=+$/g, '').replace(/\s/g, '');
  let bits = '';
  for (const char of clean) {
    const n = BASE32.indexOf(char);
    if (n < 0) throw new Error('Invalid TOTP secret.');
    bits += n.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
export function encryptTotpSecret(secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(secret), 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}
export function decryptTotpSecret(payload) {
  const [iv, tag, data] = String(payload || '').split('.');
  if (!iv || !tag || !data) throw new Error('Invalid encrypted authenticator secret.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
export function totpCode(secret, timeMs = Date.now()) {
  const counter = Math.floor(timeMs / 30000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000;
  return String(binary).padStart(6, '0');
}
export function verifyTotp(secret, candidate, timeMs = Date.now()) {
  const code = String(candidate || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return false;
  // Allow one adjacent 30-second step for normal clock drift.
  for (const delta of [-30000, 0, 30000]) {
    const expected = Buffer.from(totpCode(secret, timeMs + delta));
    const supplied = Buffer.from(code);
    if (expected.length === supplied.length && timingSafeEqual(expected, supplied)) return true;
  }
  return false;
}
export function totpUri(secret, email) {
  const label = encodeURIComponent('Budgetry:' + String(email || 'account'));
  const issuer = encodeURIComponent('Budgetry');
  return 'otpauth://totp/' + label + '?secret=' + secret + '&issuer=' + issuer + '&algorithm=SHA1&digits=6&period=30';
}
