import mongoose from 'mongoose';

const authTokenSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  purpose: { type: String, required: true, enum: ['verify-email', 'password-reset'] },
  // Only a SHA-256 digest is persisted; the raw token is emailed once.
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true, versionKey: false });

authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
authTokenSchema.index({ user: 1, purpose: 1 });
export default mongoose.model('AuthToken', authTokenSchema);
