import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import expenseRoutes from './routes/expenses.js';
import recurringRoutes from './routes/recurring.js';
import adminRoutes from './routes/admin.js';
import { requireAuth } from './middleware/auth.js';
import { requireAdmin } from './middleware/admin.js';
import { checkOrigin } from './middleware/csrf.js';
import { notFound, errorHandler } from './middleware/errors.js';

export const app = express();
app.disable('x-powered-by');
// Render terminates TLS in a reverse proxy; trust exactly one proxy hop for req.ip.
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true, methods: ['GET','POST','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '512kb' }));
app.use(cookieParser());
app.use(checkOrigin);
app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many authentication attempts. Try again later.' } });
// Root health path is convenient for uptime probes; the API alias remains supported.
const healthHandler = (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.setHeader('Cache-Control', 'no-store');
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'unavailable',
    database: connected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/verification-request', authLimiter);
app.use('/api/auth/verify-email', authLimiter);
app.use('/api/auth/password-reset/request', authLimiter);
app.post('/api/auth/password-reset', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/recurring', recurringRoutes);
// Admin APIs are authenticated and allowlisted server-side; the UI route alone is not security.
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);
app.use(notFound);
app.use(errorHandler);
