import mongoose from 'mongoose';

const auditEventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  action: { type: String, required: true, maxlength: 80, index: true },
  success: { type: Boolean, default: true },
  ipAddress: { type: String, maxlength: 80, default: '' },
  userAgent: { type: String, maxlength: 300, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true, versionKey: false });

auditEventSchema.index({ user: 1, createdAt: -1 });
auditEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });
export default mongoose.model('AuditEvent', auditEventSchema);
