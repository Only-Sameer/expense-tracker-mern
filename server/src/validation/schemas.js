import { z } from 'zod';

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Enter a valid calendar date.');
const expenseDateSchema = z.union([z.iso.datetime({ offset: true }), dateOnlySchema]);

export const categoryNameSchema = z.string().trim().min(1).max(40)
  .regex(/^[\p{L}\p{N} '&\/-]+$/u, 'Use letters, numbers, spaces, apostrophes, &, /, and hyphens.');

const passwordSchema = z.string().min(10).max(128)
  .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be no more than 72 UTF-8 bytes for bcrypt.');

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().max(254).pipe(z.email()).transform(v => v.toLowerCase()),
  password: passwordSchema,
  turnstileToken: z.string().max(2048).optional().default(''),
});

export const loginSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email()).transform(v => v.toLowerCase()),
  password: z.string().min(1).max(128).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be no more than 72 UTF-8 bytes for bcrypt.'),
  keepSignedIn: z.boolean().optional().default(true),
  turnstileToken: z.string().max(2048).optional().default(''),
  totpCode: z.string().regex(/^\d{6}$/).optional(),
});

export const expenseSchema = z.object({
  amount: z.coerce.number().positive().max(100000000),
  category: categoryNameSchema,
  date: expenseDateSchema,
  note: z.string().trim().max(300).default(''),
  tags: z.array(z.string().trim().min(1).max(24)).max(8).optional().default([]),
});

export const expenseImportSchema = z.object({ items: z.array(expenseSchema).min(1).max(250) });
export const categoryRenameSchema = z.object({ from: categoryNameSchema, to: categoryNameSchema }).refine(data => data.from !== data.to, 'Choose a different category name.');
export const expenseQuerySchema = z.object({
  search: z.string().trim().max(100).optional().default(''),
  category: categoryNameSchema.optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  sort: z.enum(['date_desc','date_asc','amount_desc','amount_asc']).optional().default('date_desc'),
  page: z.coerce.number().int().min(1).max(100000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});
export const reauthSchema = z.object({
  password: z.string().min(1).max(128).optional(),
  totpCode: z.string().regex(/^\d{6}$/).optional(),
  googleCredential: z.string().max(10000).optional(),
}).refine(data => data.password || data.googleCredential, 'Re-authentication is required.');
export const twoFactorCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/) });
