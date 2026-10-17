import test from 'node:test';
import assert from 'node:assert/strict';
import {
  budgetTone, createDemoExpenses, csvCell, filterExpenseRecords,
  money, parseCsv, sumAmounts, monthKey, formatDate, parseQuickAdd
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


test('ISO expense calendar dates display consistently without timezone day-shifts', () => {
  assert.equal(formatDate('2026-10-17T00:00:00.000Z'), '17 Oct 2026');
  assert.equal(formatDate('2026-10-17'), '17 Oct 2026');
});


test('quick-add parser handles rupee amounts, categories and relative calendar dates', () => {
  const now = new Date(2026, 9, 17, 11, 30);
  assert.deepEqual(parseQuickAdd('250 coffee yesterday', now), {
    amount: 250, category: 'Food', date: '2026-10-16', note: 'coffee'
  });
  assert.deepEqual(parseQuickAdd('₹1,250.50 metro today', now), {
    amount: 1250.5, category: 'Transport', date: '2026-10-17', note: 'metro'
  });
  assert.equal(parseQuickAdd('no amount here', now).error.includes('Start with an amount'), true);
  assert.equal(parseQuickAdd('50 rent 2026-02-31', now).error.includes('real calendar date'), true);
});
