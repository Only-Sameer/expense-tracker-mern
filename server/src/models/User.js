import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  googleId: { type: String, default: '', index: true },
  emailVerified: { type: Boolean, default: true },
  sessionVersion: { type: Number, default: 0 },
  totpSecretEncrypted: { type: String, default: '', select: false },
  totpEnabled: { type: Boolean, default: false },
  totpSetupAt: { type: Date, default: null, select: false },
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

export default mongoose.model('User', userSchema);
