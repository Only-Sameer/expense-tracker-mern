import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import User from '../models/User.js';
import Expense from '../models/Expense.js';

const router = Router();
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/overview', asyncHandler(async (req, res) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [totalUsers, newUsers30Days, totalExpenses, totals, categories, monthly, recentUsers] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    Expense.countDocuments(),
    Expense.aggregate([{ $group: { _id: null, amount: { $sum: '$amount' } } }]),
    Expense.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      { $sort: { amount: -1, _id: 1 } },
    ]),
    Expense.aggregate([
      { $match: { date: { $gte: sixMonthsAgo } } },
      { $group: {
        _id: { year: { $year: '$date' }, month: { $month: '$date' } },
        count: { $sum: 1 }, amount: { $sum: '$amount' },
      } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]),
    User.find().select('name email createdAt').sort({ createdAt: -1 }).limit(8).lean(),
  ]);

  res.json({
    generatedAt: now.toISOString(),
    summary: {
      totalUsers,
      newUsers30Days,
      totalExpenses,
      totalAmount: totals[0]?.amount ?? 0,
    },
    categories: categories.map(item => ({ category: item._id, count: item.count, amount: item.amount })),
    monthly: monthly.map(item => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      count: item.count,
      amount: item.amount,
    })),
    recentUsers: recentUsers.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    })),
  });
}));

router.get('/users', asyncHandler(async (req, res) => {
  const rawSearch = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : '';
  const requestedPage = Number.parseInt(String(req.query.page ?? '1'), 10);
  const requestedLimit = Number.parseInt(String(req.query.limit ?? '10'), 10);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(10000, requestedPage)) : 1;
  const limit = Number.isFinite(requestedLimit) ? Math.max(5, Math.min(50, requestedLimit)) : 10;
  const filter = rawSearch
    ? { $or: [
      { name: { $regex: escapeRegex(rawSearch), $options: 'i' } },
      { email: { $regex: escapeRegex(rawSearch), $options: 'i' } },
    ] }
    : {};

  const [users, total] = await Promise.all([
    User.find(filter).select('name email createdAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const userIds = users.map(user => user._id);
  const expenseCounts = userIds.length
    ? await Expense.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ])
    : [];
  const countByUser = new Map(expenseCounts.map(item => [String(item._id), item]));

  res.json({
    users: users.map(user => {
      const stats = countByUser.get(String(user._id));
      return {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        expenseCount: stats?.count ?? 0,
      };
    }),
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
}));

export default router;
