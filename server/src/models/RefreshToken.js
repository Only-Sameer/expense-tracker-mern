import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
  familyId: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  status: { type: String, enum: ['active', 'used', 'revoked'], default: 'active', index: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
  replacedByHash: { type: String, default: '' },
}, { timestamps: true, versionKey: false });

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ familyId: 1, status: 1, expiresAt: 1 });
refreshTokenSchema.index({ session: 1, status: 1 });
export default mongoose.model('RefreshToken', refreshTokenSchema);
