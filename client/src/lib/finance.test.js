import test from 'node:test';
import assert from 'node:assert/strict';
import {
  budgetTone, createDemoExpenses, csvCell, filterExpenseRecords,
  money, parseCsv, sumAmounts, monthKey
} from './finance.js';

test('INR formatting uses Indian digit grouping', () => {
  assert.equal(money(100000), '₹1,00,000');
});

test('sumAmounts handles empty input and amounts stored as strings', () => {
  assert.equal(sumAmounts([]), 0);
  assert.equal(sumAmounts([{ amount: '10.5' }, { amount: 20 }, { note: 'no amount' }]), 30.5);
});

test('budget thresholds are under 80%, warning at 80%, and over at 100%', () => {
  assert.equal(budgetTone(79, 100), 'under');
  assert.equal(budgetTone(80, 100), 'warning');
  assert.equal(budgetTone(99.99, 100), 'warning');
  assert.equal(budgetTone(100, 100), 'over');
  assert.equal(budgetTone(10, 0), 'under');
});

test('expense filters search note/category, date range and sorting', () => {
  const items = [
    { _id: 'a', amount: 400, category: 'Food', date: '2026-09-02T12:00:00Z', note: 'Lunch' },
    { _id: 'b', amount: 1200, category: 'Housing', date: '2026-09-15T12:00:00Z', note: 'Rent' },
    { _id: 'c', amount: 100, category: 'Transport', date: '2026-10-02T12:00:00Z', note: 'Metro' }
  ];
  assert.deepEqual(filterExpenseRecords(items, { query: 'lunch' }).map(x => x._id), ['a']);
  assert.deepEqual(filterExpenseRecords(items, { category: 'Rent' }).map(x => x._id), ['b']);
  assert.deepEqual(filterExpenseRecords(items, { from: '2026-09-10', to: '2026-09-30' }).map(x => x._id), ['b']);
  assert.deepEqual(filterExpenseRecords(items, { sort: 'amount_desc' }).map(x => x._id), ['b', 'a', 'c']);
});

test('CSV parser handles quoted commas, newlines and escaped quotes', () => {
  assert.deepEqual(parseCsv('Date,Amount,Category,Note\r\n2026-10-01,125,Food,"Groceries, fruit"\r\n2026-10-02,50,Other,"Said ""thanks"""'), [
    ['Date', 'Amount', 'Category', 'Note'],
    ['2026-10-01', '125', 'Food', 'Groceries, fruit'],
    ['2026-10-02', '50', 'Other', 'Said "thanks"']
  ]);
});

test('CSV export escapes quotes and guards against formula injection', () => {
  assert.equal(csvCell('hello "there"'), '"hello ""there"""');
  assert.equal(csvCell('=HYPERLINK("https://example.com")'), '"\'=HYPERLINK(""https://example.com"")"');
});

test('demo data is 60 varied expenses distributed over six months', () => {
  const expenses = createDemoExpenses();
  assert.equal(expenses.length, 60);
  assert.ok(new Set(expenses.map(item => item.category)).size >= 6);
  assert.equal(new Set(expenses.map(item => monthKey(item.date))).size, 6);
  assert.ok(expenses.every(item => Number(item.amount) > 0 && item.note.length > 0));
});
