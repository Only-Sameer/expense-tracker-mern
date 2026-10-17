import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 0.01, max: 100000000 },
  category: { type: String, required: true, enum: ['Food', 'Transport', 'Education', 'Housing', 'Health', 'Shopping', 'Bills', 'Entertainment', 'Other'] },
  date: { type: Date, required: true },
  note: { type: String, trim: true, maxlength: 300, default: '' },
}, { timestamps: true, versionKey: false });
expenseSchema.index({ user: 1, date: -1 });
expenseSchema.index({ user: 1, category: 1, date: -1 });
export default mongoose.model('Expense', expenseSchema);
