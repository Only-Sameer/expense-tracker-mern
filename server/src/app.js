import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import expenseRoutes from './routes/expenses.js';
import recurringRoutes from './routes/recurring.js';
import adminRoutes from './routes/admin.js';
import { requireAuth } from './middleware/auth.js';
import { requireAdmin } from './middleware/admin.js';
import { checkOrigin } from './middleware/csrf.js';
import { distributedRateLimit, pingRedis, redisConfiguredForHealth } from './services/redisRest.js';
import { notFound, errorHandler } from './middleware/errors.js';

export const app = express();
app.disable('x-powered-by');
// Render terminates TLS in a reverse proxy; trust exactly one proxy hop for req.ip.
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://challenges.cloudflare.com', 'https://accounts.google.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", env.CLIENT_ORIGIN, 'https://challenges.cloudflare.com', 'https://accounts.google.com', 'https://oauth2.googleapis.com', ...(env.SENTRY_DSN ? [new URL(env.SENTRY_DSN).origin] : [])],
      frameSrc: ['https://challenges.cloudflare.com', 'https://accounts.google.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      ...(env.NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : {}),
    },
  },
  strictTransportSecurity: env.NODE_ENV === 'production' ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}));
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true, methods: ['GET','POST','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '512kb' }));
app.use(cookieParser());
app.use(checkOrigin);
app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
const authIpLimiter = distributedRateLimit({ prefix: 'auth:ip', max: 60, windowSeconds: 15 * 60 });
const sensitiveAuthLimiter = distributedRateLimit({ prefix: 'auth:sensitive', max: 10, windowSeconds: 15 * 60 });
const authAccountLimiter = distributedRateLimit({
  prefix: 'auth:account',
  max: 12,
  windowSeconds: 15 * 60,
  keyFromRequest: req => String(req.body?.email || ('no-email:' + String(req.ip || 'unknown'))).toLowerCase(),
});

// Root health path is convenient for uptime probes; the API alias remains supported.
const healthHandler = async (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  const redis = await pingRedis();
  const redisReady = !redisConfiguredForHealth() || redis.ok === true;
  const healthy = databaseConnected && redisReady;
  res.setHeader('Cache-Control', 'no-store');
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'unavailable',
    database: databaseConnected ? 'connected' : 'disconnected',
    redis: redis.configured ? (redis.ok ? 'connected' : 'unavailable') : 'not_configured',
    timestamp: new Date().toISOString(),
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
app.use('/api/auth/signup', authIpLimiter, authAccountLimiter);
app.use('/api/auth/login', authIpLimiter, authAccountLimiter);
app.use('/api/auth/google', authIpLimiter);
app.use('/api/auth/verification-request', authIpLimiter, authAccountLimiter);
app.use('/api/auth/verify-email', authIpLimiter);
app.use('/api/auth/password-reset/request', authIpLimiter, authAccountLimiter);
app.post('/api/auth/password-reset', authIpLimiter);
app.use('/api/auth/2fa', sensitiveAuthLimiter);
app.use('/api/auth/reauth', sensitiveAuthLimiter);
app.use('/api/auth/logout-all', sensitiveAuthLimiter);
app.use('/api/auth/account', sensitiveAuthLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/recurring', recurringRoutes);
// Admin APIs are authenticated and allowlisted server-side; the UI route alone is not security.
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);
app.use(notFound);
app.use(errorHandler);
