import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  // Default true preserves access for existing accounts; new signup explicitly sets this false when mail is configured.
  emailVerified: { type: Boolean, default: true },
  sessionVersion: { type: Number, default: 0 },
}, { timestamps: true, versionKey: false });

export default mongoose.model('User', userSchema);
