import { z } from 'zod';

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Enter a valid calendar date.');
const expenseDateSchema = z.union([z.iso.datetime({ offset: true }), dateOnlySchema]);

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().max(254).pipe(z.email()).transform(v => v.toLowerCase()),
  password: z.string().min(10).max(128).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be no more than 72 UTF-8 bytes for bcrypt.'),
});
export const loginSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email()).transform(v => v.toLowerCase()),
  password: z.string().min(1).max(128).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be no more than 72 UTF-8 bytes for bcrypt.'),
});
const categories = ['Food','Transport','Education','Housing','Health','Shopping','Bills','Entertainment','Other'];
export const expenseSchema = z.object({
  amount: z.coerce.number().positive().max(100000000),
  category: z.enum(categories),
  date: expenseDateSchema,
  note: z.string().trim().max(300).default(''),
});
export const expenseQuerySchema = z.object({
  search: z.string().trim().max(100).optional().default(''),
  category: z.enum(categories).optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  sort: z.enum(['date_desc','date_asc','amount_desc','amount_asc']).optional().default('date_desc'),
  page: z.coerce.number().int().min(1).max(100000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});
