import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  CLIENT_ORIGIN: z.string().url(),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  REFRESH_TOKEN_SHORT_HOURS: z.coerce.number().int().min(1).max(48).default(12),
  ADMIN_EMAILS: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default(''),
  TURNSTILE_SECRET_KEY: z.string().default(''),
  GOOGLE_CLIENT_ID: z.string().default(''),
  REDIS_URL: z.string().default(''),
  REDIS_REST_URL: z.string().default(''),
  REDIS_REST_TOKEN: z.string().default(''),
  SENTRY_DSN: z.string().url().or(z.literal('')).default(''),
  TOTP_ENCRYPTION_KEY: z.string().default(''),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
if (parsed.data.COOKIE_SAME_SITE === 'none' && parsed.data.COOKIE_SECURE !== 'true') {
  console.error('COOKIE_SAME_SITE=none requires COOKIE_SECURE=true');
  process.exit(1);
}
if (Boolean(parsed.data.RESEND_API_KEY) !== Boolean(parsed.data.EMAIL_FROM)) {
  console.error('RESEND_API_KEY and EMAIL_FROM must either both be configured or both be empty.');
  process.exit(1);
}
if (parsed.data.TOTP_ENCRYPTION_KEY && parsed.data.TOTP_ENCRYPTION_KEY.length < 32) {
  console.error('TOTP_ENCRYPTION_KEY must be at least 32 characters when configured.');
  process.exit(1);
}
if (parsed.data.REDIS_URL && (parsed.data.REDIS_REST_URL || parsed.data.REDIS_REST_TOKEN)) {
  console.error('Configure either REDIS_URL or the REDIS_REST_URL/REDIS_REST_TOKEN pair, not both.');
  process.exit(1);
}
if (Boolean(parsed.data.REDIS_REST_URL) !== Boolean(parsed.data.REDIS_REST_TOKEN)) {
  console.error('REDIS_REST_URL and REDIS_REST_TOKEN must either both be configured or both be empty.');
  process.exit(1);
}
if (parsed.data.REDIS_URL && !/^rediss?:\/\//i.test(parsed.data.REDIS_URL)) {
  console.error('REDIS_URL must use redis:// or rediss://.');
  process.exit(1);
}
if (parsed.data.REDIS_REST_URL && !/^https:\/\//i.test(parsed.data.REDIS_REST_URL)) {
  console.error('REDIS_REST_URL must use HTTPS.');
  process.exit(1);
}
export const env = parsed.data;
