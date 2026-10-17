import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  familyId: { type: String, required: true, index: true },
  currentRefreshHash: { type: String, required: true, select: false },
  keepSignedIn: { type: Boolean, default: true },
  userAgent: { type: String, default: '', maxlength: 300 },
  ipAddress: { type: String, default: '', maxlength: 80 },
  lastUsedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  recentAuthAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ user: 1, revokedAt: 1, lastUsedAt: -1 });
sessionSchema.index({ familyId: 1, revokedAt: 1 });

export default mongoose.model('Session', sessionSchema);
