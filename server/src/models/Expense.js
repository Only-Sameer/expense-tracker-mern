import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recurringRuleId: { type: mongoose.Schema.Types.ObjectId, ref: 'RecurringExpense', default: undefined },
  recurringMonth: { type: String, default: undefined, match: /^\d{4}-\d{2}$/ },
  amount: { type: Number, required: true, min: 0.01, max: 100000000 },
  category: { type: String, required: true, trim: true, maxlength: 40, match: /^[\p{L}\p{N} '&\/-]+$/u },
  date: { type: Date, required: true },
  note: { type: String, trim: true, maxlength: 300, default: '' },
  tags: { type: [String], default: [], validate: values => values.length <= 8 && values.every(tag => typeof tag === 'string' && tag.trim().length > 0 && tag.length <= 24) },
}, { timestamps: true, versionKey: false });
expenseSchema.index({ user: 1, date: -1 });
expenseSchema.index({ user: 1, category: 1, date: -1 });
// Idempotency guard for recurring rules; ordinary expenses are excluded by the partial filter.
expenseSchema.index(
  { user: 1, recurringRuleId: 1, recurringMonth: 1 },
  { unique: true, partialFilterExpression: { recurringRuleId: { $exists: true }, recurringMonth: { $type: 'string' } } },
);
export default mongoose.model('Expense', expenseSchema);
