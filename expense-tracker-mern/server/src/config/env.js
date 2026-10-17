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
  JWT_EXPIRES_IN: z.string().default('7d'),
  // Comma-separated email allowlist for the administrative dashboard.
  ADMIN_EMAILS: z.string().default(''),
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
export const env = parsed.data;
