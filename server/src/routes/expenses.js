import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import Expense from '../models/Expense.js';
import { requireAuth } from '../middleware/auth.js';
import { expenseSchema, expenseQuerySchema } from '../validation/schemas.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const q = expenseQuerySchema.parse(req.query);
  if (q.from && q.to && q.from > q.to) return res.status(400).json({ error: 'Start date must be on or before end date.' });
  const filter = { user: req.user._id };
  if (q.category) filter.category = q.category;
  if (q.from || q.to) {
    filter.date = {};
    if (q.from) {
      const from = new Date(q.from);
      if (Number.isNaN(from.getTime())) return res.status(400).json({ error: 'Invalid start date.' });
      filter.date.$gte = from;
    }
    if (q.to) {
      const to = new Date(q.to);
      if (Number.isNaN(to.getTime())) return res.status(400).json({ error: 'Invalid end date.' });
      to.setUTCHours(23, 59, 59, 999);
      filter.date.$lte = to;
    }
  }
  if (q.search) filter.note = { $regex: q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  const sortMap = { date_desc: { date: -1 }, date_asc: { date: 1 }, amount_desc: { amount: -1 }, amount_asc: { amount: 1 } };
  const [items, total] = await Promise.all([
    Expense.find(filter).sort(sortMap[q.sort]).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
    Expense.countDocuments(filter),
  ]);
  res.json({ items, total, page: q.page, limit: q.limit, pages: Math.ceil(total / q.limit) });
}));
router.get('/summary/monthly', asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return res.status(400).json({ error: 'Invalid year.' });
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const rows = await Expense.aggregate([
    { $match: { user: req.user._id, date: { $gte: start, $lt: end } } },
    { $group: { _id: { $month: '$date' }, total: { $sum: '$amount' } } },
    { $sort: { _id: 1 } },
  ]);
  const totals = Array.from({ length: 12 }, (_, i) => ({ month: new Date(Date.UTC(year, i, 1)).toLocaleString('en', { month: 'short', timeZone: 'UTC' }), total: 0 }));
  rows.forEach(row => { totals[row._id - 1].total = Math.round(row.total * 100) / 100; });
  res.json({ year, months: totals });
}));
router.get('/csv', asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const items = await Expense.find({ user: req.user._id }).sort({ date: -1 }).lean();
  const cell = value => {
    // Prevent spreadsheet formula injection and quote CSV cells correctly.
    const str = String(value ?? '');
    const safe = /^\s*[=+\-@]/.test(str) ? `'${str}` : str;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = [['Date','Amount','Category','Note'], ...items.map(e => [new Date(e.date).toISOString().slice(0,10), e.amount, e.category, e.note])].map(row => row.map(cell).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="expenses.csv"');
  res.send('\uFEFF' + csv);
}));
router.post('/', asyncHandler(async (req, res) => {
  const data = expenseSchema.parse(req.body);
  const item = await Expense.create({ ...data, date: new Date(data.date), user: req.user._id });
  res.status(201).json({ item });
}));
router.patch('/:id', asyncHandler(async (req, res) => {
  const data = expenseSchema.parse(req.body);
  const item = await Expense.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { ...data, date: new Date(data.date) }, { new: true, runValidators: true },
  );
  if (!item) return res.status(404).json({ error: 'Expense not found.' });
  res.json({ item });
}));
router.delete('/:id', asyncHandler(async (req, res) => {
  const item = await Expense.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!item) return res.status(404).json({ error: 'Expense not found.' });
  res.status(204).end();
}));
export default router;
