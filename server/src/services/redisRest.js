import { createHash } from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';
import { env } from '../config/env.js';
import RateLimitCounter from '../models/RateLimitCounter.js';

/**
 * Shared rate-limit/session control adapter. In Render production, configure
 * REDIS_REST_URL + REDIS_REST_TOKEN (Upstash-compatible HTTPS). REDIS_URL is
 * also supported for a local redis:// or rediss:// endpoint in Docker.
 * MongoDB-backed atomic counters provide a shared fallback if Redis is absent or
 * temporarily unavailable. This keeps limits stateless across API replicas.
 */
let warned = false;
const redisConfigured = () => Boolean(env.REDIS_URL || (env.REDIS_REST_URL && env.REDIS_REST_TOKEN));
const safeKey = value => String(value).replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 180);

function warnRedisFallback(error) {
  if (warned) return;
  warned = true;
  // Log neither the Redis URL nor keys/tokens; those may include credentials.
  console.error('Redis control-store unavailable; atomically falling back to MongoDB-backed counters.', error?.message || '');
}
async function mongoIncrement(key, windowSeconds) {
  const now = new Date();
  const newExpiry = new Date(now.getTime() + Math.max(1, Math.floor(windowSeconds)) * 1000);
  // One update-pipeline operation safely creates or resets expired windows under concurrency.
  const live = { $gt: ['$expiresAt', now] };
  const nextCount = { $cond: [live, { $add: [{ $ifNull: ['$count', 0] }, 1] }, 1] };
  let record;
  try {
    record = await RateLimitCounter.findOneAndUpdate(
    { key },
    [{ $set: {
      count: nextCount,
      value: { $toString: nextCount },
      expiresAt: { $cond: [live, '$expiresAt', newExpiry] },
    } }],
    { upsert: true, new: true, updatePipeline: true },
    ).lean();
  } catch (error) {
    if (error?.code === 11000) return mongoIncrement(key, windowSeconds);
    throw error;
  }
  return Number(record.count);
}
async function mongoGet(key) {
  const record = await RateLimitCounter.findOne({ key }).select('value expiresAt').lean();
  if (!record || record.expiresAt <= new Date()) return null;
  return String(record.value);
}
async function mongoSet(key, value, ttlSeconds) {
  const expiresAt = new Date(Date.now() + Math.max(1, Math.floor(ttlSeconds)) * 1000);
  await RateLimitCounter.findOneAndUpdate(
    { key },
    { $set: { value: String(value), count: Number(value) || 0, expiresAt } },
    { upsert: true, new: true },
  );
}
async function mongoDelete(key) {
  await RateLimitCounter.deleteOne({ key });
}

function encodeResp(parts) {
  return '*' + parts.length + '\r\n' + parts.map(part => {
    const value = String(part);
    return '$' + Buffer.byteLength(value) + '\r\n' + value + '\r\n';
  }).join('');
}
function parseResp(buffer, offset = 0) {
  if (offset >= buffer.length) return null;
  const type = String.fromCharCode(buffer[offset]);
  const lineEnd = buffer.indexOf('\r\n', offset);
  if (lineEnd < 0) return null;
  const text = buffer.toString('utf8', offset + 1, lineEnd);
  if (type === '+' || type === '-') {
    return { value: type === '-' ? new Error(text) : text, offset: lineEnd + 2 };
  }
  if (type === ':') return { value: Number(text), offset: lineEnd + 2 };
  if (type === '$') {
    const size = Number(text);
    if (size === -1) return { value: null, offset: lineEnd + 2 };
    const end = lineEnd + 2 + size;
    if (buffer.length < end + 2) return null;
    return { value: buffer.toString('utf8', lineEnd + 2, end), offset: end + 2 };
  }
  if (type === '*') {
    const count = Number(text);
    if (count === -1) return { value: null, offset: lineEnd + 2 };
    let cursor = lineEnd + 2;
    const values = [];
    for (let i = 0; i < count; i += 1) {
      const parsed = parseResp(buffer, cursor);
      if (!parsed) return null;
      if (parsed.value instanceof Error) throw parsed.value;
      values.push(parsed.value);
      cursor = parsed.offset;
    }
    return { value: values, offset: cursor };
  }
  throw new Error('Unsupported Redis response.');
}

async function nativeCommand(parts) {
  const uri = new URL(env.REDIS_URL);
  const secure = uri.protocol === 'rediss:';
  if (!secure && uri.protocol !== 'redis:') throw new Error('REDIS_URL must use redis:// or rediss://.');
  const commands = [];
  const username = decodeURIComponent(uri.username || '');
  const password = decodeURIComponent(uri.password || '');
  if (password) commands.push(username ? ['AUTH', username, password] : ['AUTH', password]);
  const database = uri.pathname && uri.pathname !== '/' ? Number(uri.pathname.slice(1)) : 0;
  if (Number.isInteger(database) && database > 0) commands.push(['SELECT', database]);
  commands.push(parts);
  const port = Number(uri.port || 6379);

  return new Promise((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host: uri.hostname, port, servername: uri.hostname })
      : net.connect({ host: uri.hostname, port });
    let buffer = Buffer.alloc(0);
    let parsedCount = 0;
    let lastValue;
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(value);
    };
    const writeCommands = () => socket.write(commands.map(encodeResp).join(''));
    socket.setTimeout(2500, () => finish(new Error('Redis connection timed out.')));
    socket.once('error', error => finish(error));
    if (secure) socket.once('secureConnect', writeCommands);
    else socket.once('connect', writeCommands);
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        while (parsedCount < commands.length) {
          const parsed = parseResp(buffer);
          if (!parsed) break;
          if (parsed.value instanceof Error) return finish(parsed.value);
          lastValue = parsed.value;
          buffer = buffer.subarray(parsed.offset);
          parsedCount += 1;
        }
        if (parsedCount === commands.length) finish(null, lastValue);
      } catch (error) {
        finish(error);
      }
    });
  });
}

async function restCommand(parts) {
  const path = parts.map((part, index) => index === 0
    ? encodeURIComponent(String(part).toLowerCase())
    : encodeURIComponent(String(part))).join('/');
  const response = await fetch(env.REDIS_REST_URL.replace(/\/+$/, '') + '/' + path, {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + env.REDIS_REST_TOKEN },
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new Error('Redis REST command failed with status ' + response.status);
  const data = await response.json();
  if (data.error) throw new Error('Redis REST command failed.');
  return data.result;
}
async function command(parts) {
  if (env.REDIS_URL) return nativeCommand(parts);
  if (env.REDIS_REST_URL && env.REDIS_REST_TOKEN) return restCommand(parts);
  throw new Error('Redis is not configured.');
}
function warnFallback(error) {
  if (warned) return;
  warned = true;
  console.error('Redis-backed controls are unavailable; using per-process fallback. Configure shared Redis for multi-instance safety.', error?.message || '');
}
export function privacyKey(value) {
  return createHash('sha256').update(String(value || '')).digest('hex').slice(0, 32);
}
export async function incrementCounter(key, windowSeconds = 900) {
  const k = safeKey(key);
  if (!redisConfigured()) return mongoIncrement(k, windowSeconds);
  try {
    const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n";
    return Number(await command(['EVAL', script, 1, k, Math.max(1, Math.floor(windowSeconds))]));
  } catch (error) {
    warnRedisFallback(error);
    return mongoIncrement(k, windowSeconds);
  }
}
export async function getCounter(key) {
  const k = safeKey(key);
  if (!redisConfigured()) return mongoGet(k);
  try {
    const value = await command(['GET', k]);
    return value == null ? null : String(value);
  } catch (error) {
    warnRedisFallback(error);
    return mongoGet(k);
  }
}
export async function setCounter(key, value, ttlSeconds = 60) {
  const k = safeKey(key);
  if (!redisConfigured()) return mongoSet(k, value, ttlSeconds);
  try { await command(['SET', k, value, 'EX', Math.max(1, Math.floor(ttlSeconds))]); }
  catch (error) { warnRedisFallback(error); await mongoSet(k, value, ttlSeconds); }
}
export async function deleteCounter(key) {
  const k = safeKey(key);
  if (!redisConfigured()) return mongoDelete(k);
  try { await command(['DEL', k]); }
  catch (error) { warnRedisFallback(error); await mongoDelete(k); }
}
export async function pingRedis() {
  if (!redisConfigured()) return { configured: false, ok: null };
  try { return { configured: true, ok: String(await command(['PING'])).toUpperCase() === 'PONG' }; }
  catch { return { configured: true, ok: false }; }
}
export function distributedRateLimit({ prefix, max = 30, windowSeconds = 900, keyFromRequest } = {}) {
  return async (req, res, next) => {
    try {
      const id = keyFromRequest ? keyFromRequest(req) : (req.ip || 'unknown');
      const count = await incrementCounter(prefix + ':' + privacyKey(id), windowSeconds);
      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', String(Math.max(0, max - count)));
      if (count > max) {
        res.setHeader('Retry-After', String(windowSeconds));
        return res.status(429).json({ error: 'Too many requests. Please wait a little before trying again.' });
      }
      return next();
    } catch (error) {
      // Safe diagnostics only: never log request bodies, emails, keys, or credentials.
      console.error('Authentication rate-limit counter failed.', {
        errorName: error?.name || 'UnknownError',
        errorCode: typeof error?.code === 'string' || typeof error?.code === 'number' ? error.code : undefined,
        mongoCodeName: typeof error?.codeName === 'string' ? error.codeName : undefined,
        // Include the operation failure reason while redacting URI-style credentials.
        errorMessage: String(error?.message || 'No error message')
          .replace(/(mongodb(?:\+srv)?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@')
          .slice(0, 240),
      });
      return res.status(503).json({ error: 'Authentication protections are temporarily unavailable. Please try again shortly.' });
    }
  };
}
export function redisConfiguredForHealth() {
  return redisConfigured();
}


/** Shared short-lived JSON cache; uses Redis first and MongoDB for a shared fallback. */
export async function getSharedValue(key) {
  const k = safeKey(key);
  try {
    if (redisConfigured()) {
      try {
        const value = await command(['GET', k]);
        return value == null ? null : String(value);
      } catch (error) {
        warnRedisFallback(error);
      }
    }
    return await mongoGet(k);
  } catch {
    return null;
  }
}
export async function setSharedValue(key, value, ttlSeconds = 60) {
  const k = safeKey(key);
  const serialized = String(value);
  if (redisConfigured()) {
    try {
      await command(['SET', k, serialized, 'EX', Math.max(1, Math.floor(ttlSeconds))]);
      return;
    } catch (error) {
      warnRedisFallback(error);
    }
  }
  await mongoSet(k, serialized, ttlSeconds);
}
export async function deleteSharedValue(key) {
  const k = safeKey(key);
  if (redisConfigured()) {
    try {
      await command(['DEL', k]);
      return;
    } catch (error) {
      warnRedisFallback(error);
    }
  }
  await mongoDelete(k);
}
export async function aggregateCacheVersion(userId) {
  return String((await getCounter('aggregate:version:' + String(userId))) || '0');
}
export async function invalidateExpenseAggregates(userId) {
  // A monotonically increasing version invalidates all previously cached aggregate
  // variants for this user without a wildcard delete (and without local memory).
  await incrementCounter('aggregate:version:' + String(userId), 315360000);
}
