import mongoose from 'mongoose';

const recurringExpenseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  amount: { type: Number, required: true, min: 0.01, max: 100000000 },
  category: { type: String, required: true, trim: true, maxlength: 40, match: /^[\p{L}\p{N} '&\/-]+$/u },
  dueDay: { type: Number, required: true, min: 1, max: 31, validate: Number.isInteger },
  isActive: { type: Boolean, default: true },
  // One successful generation per rule per calendar month.
  lastGeneratedMonth: { type: String, default: '' },
}, { timestamps: true, versionKey: false });

recurringExpenseSchema.index({ user: 1, isActive: 1, dueDay: 1 });
export default mongoose.model('RecurringExpense', recurringExpenseSchema);
