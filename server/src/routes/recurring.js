import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import Expense from '../models/Expense.js';
import RecurringExpense from '../models/RecurringExpense.js';

const router = Router();
router.use(requireAuth);

const recurringSchema = z.object({
  name: z.string().trim().min(1).max(80),
  amount: z.coerce.number().positive().max(100000000),
  category: z.string().trim().min(1).max(40).regex(/^[\p{L}\p{N} '&\/-]+$/u),
  dueDay: z.coerce.number().int().min(1).max(31),
});

function monthStamp(date) {
  return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0');
}

/**
 * Create due recurring entries on demand. Atomic claim on lastGeneratedMonth
 * prevents two tabs or concurrent requests from creating duplicate entries.
 * Each rule creates at most one expense per month.
 */
async function createDueExpenses(userId, now = new Date()) {
  const stamp = monthStamp(now);
  const today = now.getUTCDate();
  const dueRules = await RecurringExpense.find({
    user: userId,
    isActive: true,
    dueDay: { $lte: today },
    lastGeneratedMonth: { $ne: stamp },
  }).lean();
  let generated = 0;
  const generatedItems = [];

  for (const rule of dueRules) {
    const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    const dueDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), Math.min(rule.dueDay, lastDay), 12));
    let created = null;
    try {
      // Create first with a unique (user, rule, month) key. If the process stops
      // between this insert and the marker update, the next request sees the
      // duplicate key, advances the marker, and does not create a second expense.
      created = await Expense.create({
        user: userId,
        recurringRuleId: rule._id,
        recurringMonth: stamp,
        amount: rule.amount,
        category: rule.category,
        date: dueDate,
        note: rule.name,
      });
      generatedItems.push(created.toObject());
      generated += 1;
    } catch (error) {
      if (error?.code !== 11000) throw error;
      // This rule/month was already created by a concurrent request or a retry.
    }

    await RecurringExpense.updateOne(
      { _id: rule._id, user: userId },
      { $set: { lastGeneratedMonth: stamp } },
    );
  }
  return { generated, generatedItems };
}
router.get('/', asyncHandler(async (req, res) => {
  const generation = await createDueExpenses(req.user._id);
  const items = await RecurringExpense.find({ user: req.user._id, isActive: true })
    .sort({ dueDay: 1, createdAt: 1 }).lean();
  res.setHeader('Cache-Control', 'no-store');
  res.json({ items, generated: generation.generated, generatedItems: generation.generatedItems });
}));

router.post('/', asyncHandler(async (req, res) => {
  const data = recurringSchema.parse(req.body);
  const item = await RecurringExpense.create({ ...data, user: req.user._id });
  const generation = await createDueExpenses(req.user._id);
  const refreshed = await RecurringExpense.findById(item._id).lean();
  res.status(201).json({ item: refreshed, generated: generation.generated, generatedItems: generation.generatedItems });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const item = await RecurringExpense.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!item) return res.status(404).json({ error: 'Recurring expense not found.' });
  res.status(204).end();
}));

export default router;
