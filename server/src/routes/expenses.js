import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import Expense from '../models/Expense.js';
import RecurringExpense from '../models/RecurringExpense.js';
import { writeAuditEvent } from '../services/auditLog.js';
import { aggregateCacheVersion, getSharedValue, setSharedValue, invalidateExpenseAggregates as bumpAggregateVersion } from '../services/redisRest.js';

async function invalidateCachedAggregates(userId) {
  try { await bumpAggregateVersion(userId); }
  catch (error) { console.error('Aggregate cache invalidation failed:', error?.message || 'unknown error'); }
}
import { requireAuth } from '../middleware/auth.js';
import { expenseSchema, expenseQuerySchema, expenseImportSchema, categoryRenameSchema } from '../validation/schemas.js';

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
  if (q.search) {
        const escaped = q.search.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/[{}]/g, '\\$&');
    filter.$or = [
      { note: { $regex: escaped, $options: 'i' } },
      { tags: { $regex: escaped, $options: 'i' } },
      { category: { $regex: escaped, $options: 'i' } },
    ];
  }
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

  const userId = String(req.user._id);
  const version = await aggregateCacheVersion(userId);
  const key = 'aggregate:monthly:' + userId + ':' + year + ':v' + version;
  const cached = await getSharedValue(key);
  if (cached) {
    try {
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json(JSON.parse(cached));
    } catch { /* Ignore malformed cache entries and recompute from MongoDB. */ }
  }

  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const rows = await Expense.aggregate([
    { $match: { user: req.user._id, date: { $gte: start, $lt: end } } },
    { $group: { _id: { $month: '$date' }, total: { $sum: '$amount' } } },
    { $sort: { _id: 1 } },
  ]);
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: new Date(Date.UTC(year, i, 1)).toLocaleString('en', { month: 'short', timeZone: 'UTC' }),
    total: 0,
  }));
  rows.forEach(row => { months[row._id - 1].total = Math.round(row.total * 100) / 100; });
  const result = { year, months };
  await setSharedValue(key, JSON.stringify(result), 60);
  res.setHeader('Cache-Control', 'private, no-store');
  res.json(result);
}));

router.get('/summary/categories', asyncHandler(async (req, res) => {
  const month = String(req.query.month || '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ error: 'Provide month in YYYY-MM format.' });
  }
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));
  const userId = String(req.user._id);
  const version = await aggregateCacheVersion(userId);
  const key = 'aggregate:categories:' + userId + ':' + month + ':v' + version;
  const cached = await getSharedValue(key);
  if (cached) {
    try {
      res.setHeader('Cache-Control', 'private, no-store');
      return res.json(JSON.parse(cached));
    } catch { /* Ignore malformed cache entries and recompute. */ }
  }

  const rows = await Expense.aggregate([
    { $match: { user: req.user._id, date: { $gte: start, $lt: end } } },
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);
  const categories = rows.map(row => ({
    category: row._id,
    total: Math.round(row.total * 100) / 100,
    count: row.count,
  }));
  const result = {
    month,
    total: Math.round(categories.reduce((sum, item) => sum + item.total, 0) * 100) / 100,
    categories,
  };
  await setSharedValue(key, JSON.stringify(result), 60);
  res.setHeader('Cache-Control', 'private, no-store');
  res.json(result);
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
  const csv = [['Date','Amount','Category','Note','Tags'], ...items.map(e => [new Date(e.date).toISOString().slice(0,10), e.amount, e.category, e.note, (e.tags || []).join('|')])].map(row => row.map(cell).join(',')).join('\r\n');
  await writeAuditEvent(req, { action: 'expenses-csv-exported', metadata: { count: items.length } });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="expenses.csv"');
  res.send('\uFEFF' + csv);
}));
router.patch('/categories/rename', asyncHandler(async (req, res) => {
  const data = categoryRenameSchema.parse(req.body);
  const [result, recurringResult] = await Promise.all([
    Expense.updateMany(
      { user: req.user._id, category: data.from },
      { $set: { category: data.to } },
      { runValidators: true },
    ),
    RecurringExpense.updateMany(
      { user: req.user._id, category: data.from },
      { $set: { category: data.to } },
      { runValidators: true },
    ),
  ]);
  await invalidateCachedAggregates(req.user._id);
  await writeAuditEvent(req, { action: 'category-renamed', metadata: { from: data.from, to: data.to, expenseCount: result.modifiedCount, recurringCount: recurringResult.modifiedCount } });
  res.json({
    from: data.from,
    to: data.to,
    modifiedCount: result.modifiedCount,
    recurringModifiedCount: recurringResult.modifiedCount,
  });
}));
router.post('/import', asyncHandler(async (req, res) => {
  // Validate the entire import before writing any row, avoiding partial per-row imports.
  const data = expenseImportSchema.parse(req.body);
  const records = data.items.map(item => ({ ...item, date: new Date(item.date), user: req.user._id }));
  const items = await Expense.insertMany(records, { ordered: true });
  await invalidateCachedAggregates(req.user._id);
  await writeAuditEvent(req, { action: 'expenses-imported', metadata: { count: items.length } });
  res.status(201).json({ items });
}));
router.post('/', asyncHandler(async (req, res) => {
  const data = expenseSchema.parse(req.body);
  const item = await Expense.create({ ...data, date: new Date(data.date), user: req.user._id });
  await invalidateCachedAggregates(req.user._id);
  await writeAuditEvent(req, { action: 'expense-created', metadata: { category: item.category } });
  res.status(201).json({ item });
}));
router.patch('/:id', asyncHandler(async (req, res) => {
  const data = expenseSchema.parse(req.body);
  const item = await Expense.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { ...data, date: new Date(data.date) }, { new: true, runValidators: true },
  );
  if (!item) return res.status(404).json({ error: 'Expense not found.' });
  await invalidateCachedAggregates(req.user._id);
  await writeAuditEvent(req, { action: 'expense-updated', metadata: { category: item.category } });
  res.json({ item });
}));
router.delete('/:id', asyncHandler(async (req, res) => {
  const item = await Expense.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!item) return res.status(404).json({ error: 'Expense not found.' });
  await invalidateCachedAggregates(req.user._id);
  await writeAuditEvent(req, { action: 'expense-deleted', metadata: { category: item.category } });
  res.status(204).end();
}));
export default router;
