import mongoose from 'mongoose';

/**
 * Shared fallback for short-lived authentication counters when Redis is not
 * configured. The TTL index reclaims expired keys; keys contain hashed identities.
 */
const rateLimitCounterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, maxlength: 180 },
  count: { type: Number, required: true, default: 0 },
  value: { type: String, required: true, default: '0', maxlength: 100000 },
  expiresAt: { type: Date, required: true },
}, { timestamps: true, versionKey: false });

rateLimitCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('RateLimitCounter', rateLimitCounterSchema);
