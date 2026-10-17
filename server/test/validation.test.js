import test from 'node:test';
import assert from 'node:assert/strict';
import { signupSchema, expenseSchema, categoryRenameSchema, expenseImportSchema } from '../src/validation/schemas.js';

test('signup normalizes email and rejects short passwords', () => {
  assert.equal(signupSchema.parse({ name: ' Ada ', email: 'ADA@example.com', password: 'long-password' }).email, 'ada@example.com');
  assert.throws(() => signupSchema.parse({ name: 'Ada', email: 'ada@example.com', password: 'short' }));
});
test('expense schema rejects non-positive amounts and unsafe category text', () => {
  assert.throws(() => expenseSchema.parse({ amount: 0, category: 'Food', date: '2026-01-01', note: '' }));
  assert.doesNotThrow(() => expenseSchema.parse({ amount: 3, category: 'Home & utilities', date: '2026-01-01', note: '' }));
  assert.throws(() => expenseSchema.parse({ amount: 3, category: '<script>alert(1)</script>', date: '2026-01-01', note: '' }));
});

test('expense dates accept real calendar days and reject impossible dates', () => {
  assert.doesNotThrow(() => expenseSchema.parse({ amount: 3, category: 'Food', date: '2026-10-17', note: '' }));
  assert.throws(() => expenseSchema.parse({ amount: 3, category: 'Food', date: '2026-02-31', note: '' }));
});
test('bcrypt byte limit rejects passwords longer than 72 UTF-8 bytes', () => {
  assert.throws(() => signupSchema.parse({ name: 'Ada', email: 'ada@example.com', password: 'é'.repeat(40) }));
});


test('category rename rejects identical and unsafe category names', () => {
  assert.throws(() => categoryRenameSchema.parse({ from: 'Food', to: 'Food' }));
  assert.throws(() => categoryRenameSchema.parse({ from: 'Food', to: '<img src=x>' }));
  assert.deepEqual(categoryRenameSchema.parse({ from: 'Home', to: 'Home & utilities' }), { from: 'Home', to: 'Home & utilities' });
});

test('CSV batch import validates records and caps request size', () => {
  assert.doesNotThrow(() => expenseImportSchema.parse({ items: [{ amount: 12, category: 'Food', date: '2026-10-17', note: '' }] }));
  assert.throws(() => expenseImportSchema.parse({ items: [{ amount: 0, category: 'Food', date: '2026-10-17', note: '' }] }));
  assert.throws(() => expenseImportSchema.parse({ items: Array.from({ length: 251 }, () => ({ amount: 12, category: 'Food', date: '2026-10-17', note: '' })) }));
});
