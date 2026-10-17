export const CATEGORIES = ['Food', 'Transport', 'Rent', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Other', 'Education'];
export const META = {
  Food: { icon: '🍽', color: '#F59E0B' }, Transport: { icon: '↗', color: '#60A5FA' },
  Rent: { icon: '⌂', color: '#A78BFA' }, Housing: { icon: '⌂', color: '#A78BFA' },
  Shopping: { icon: '◇', color: '#F472B6' }, Bills: { icon: '▤', color: '#38BDF8' },
  Health: { icon: '＋', color: '#FB7185' }, Entertainment: { icon: '♫', color: '#C084FC' },
  Other: { icon: '•••', color: '#94A3B8' }, Education: { icon: '▣', color: '#34D399' }
};
export const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const money = n => INR.format(Number(n) || 0);
export const today = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
export const monthKey = value => {
  // Preserve the calendar date stored by the API instead of shifting UTC midnight
  // into the previous day/month for users in negative-offset time zones.
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2})/);
    if (match) return match[1];
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
};
export const shiftMonth = (key, n) => { const p = key.split('-').map(Number); const d = new Date(p[0], p[1] - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
export const monthLabel = key => { const p = key.split('-').map(Number); return new Date(p[0], p[1] - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); };
export const dayKey = item => {
  const value = item?.date;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};
export const formatDate = value => {
  // Expense dates are calendar dates, not moments. Preserve the ISO calendar day
  // before formatting so time zones cannot display a record as the previous day.
  let d;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    d = new Date(year, month - 1, day);
  } else {
    d = new Date(value);
  }
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
export const displayCategory = c => c === 'Housing' ? 'Rent' : c;
export const serverCategory = c => c === 'Rent' ? 'Housing' : c;
export const itemId = item => String(item?._id || item?.id || '');

export function createDemoExpenses() {
  const templates = [
    ['Food', 185, 'Coffee and breakfast'], ['Food', 420, 'Lunch'], ['Food', 275, 'Dinner'],
    ['Transport', 90, 'Metro / bus'], ['Transport', 240, 'Cab ride'], ['Rent', 11500, 'Monthly rent'],
    ['Shopping', 799, 'Household essentials'], ['Bills', 649, 'Mobile and internet'],
    ['Health', 350, 'Pharmacy'], ['Entertainment', 499, 'Streaming subscription'],
    ['Other', 160, 'Small daily purchase'], ['Education', 1200, 'Course materials'],
    ['Food', 1250, 'Weekend groceries'], ['Transport', 160, 'Fuel'], ['Bills', 899, 'Electricity bill'],
    ['Entertainment', 650, 'Movie night'], ['Shopping', 1299, 'Shoes'], ['Health', 550, 'Clinic visit'],
    ['Food', 320, 'Snacks'], ['Other', 320, 'Laundry']
  ];
  const out = [];
  const now = new Date();
  for (let i = 0; i < 60; i += 1) {
    const t = templates[(i * 7 + Math.floor(i / 3)) % templates.length];
    const offset = Math.floor(i / 10) % 6;
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const day = Math.min(lastDay, ((i * 3 + 4) % lastDay) + 1);
    out.push({
      _id: 'demo-' + i,
      amount: t[1] + ((i * 43) % 8) * 25,
      category: t[0],
      date: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0') + 'T12:00:00.000Z',
      note: t[2]
    });
  }
  return out.sort((a, b) => new Date(b.date) - new Date(a.date));
}
export function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
export function csvCell(value) {
  let s = String(value ?? '');
  if (/^\s*[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
export function parseCsv(input) {
  const text = String(input || '').replace(/^\uFEFF/, '');
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted && ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { row.push(field); field = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); if (row.some(x => x.trim())) rows.push(row); row = []; field = '';
    } else field += ch;
  }
  row.push(field); if (row.some(x => x.trim())) rows.push(row);
  return rows;
}


/** Pure helpers shared by the UI and unit tests. */
export function sumAmounts(items = []) {
  return items.reduce((sum, item) => sum + Number(item?.amount || 0), 0);
}

export function budgetTone(spent, limit) {
  if (!(Number(limit) > 0)) return 'under';
  const ratio = Number(spent || 0) / Number(limit);
  if (ratio >= 1) return 'over';
  if (ratio >= 0.8) return 'warning';
  return 'under';
}

export function filterExpenseRecords(items = [], options = {}) {
  const query = String(options.query || '').trim().toLowerCase();
  const category = options.category || 'All';
  const from = options.from || '';
  const to = options.to || '';
  const sort = options.sort || 'date_desc';
  return items.filter(item => {
    const itemCategory = displayCategory(item.category);
    const tags = Array.isArray(item.tags) ? item.tags.join(' ').toLowerCase() : '';
    if (query && !String(item.note || '').toLowerCase().includes(query) &&
        !itemCategory.toLowerCase().includes(query) && !tags.includes(query)) return false;
    if (category !== 'All' && itemCategory !== category) return false;
    const date = dayKey(item);
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }).sort((a, b) => {
    if (sort === 'amount_asc') return Number(a.amount) - Number(b.amount);
    if (sort === 'amount_desc') return Number(b.amount) - Number(a.amount);
    return sort === 'date_asc'
      ? new Date(a.date) - new Date(b.date)
      : new Date(b.date) - new Date(a.date);
  });
}


/**
 * Parse a concise quick entry such as "250 coffee yesterday".
 * This is a deliberately small grammar; users review and edit parsed values before saving.
 */
export function parseQuickAdd(input, now = new Date()) {
  const raw = String(input || '').trim();
  const match = raw.match(/^(?:₹\s*)?((?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?)\s+(.+)$/);
  if (!match) return { error: 'Start with an amount, for example: 250 coffee yesterday.' };
  const amount = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter an amount greater than zero.' };

  let remainder = match[2].trim();
  let date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateMatch = remainder.match(/\s+(today|yesterday|tomorrow|last night)$/i);
  if (dateMatch) {
    const keyword = dateMatch[1].toLowerCase();
    date.setDate(date.getDate() + (keyword === 'yesterday' || keyword === 'last night' ? -1 : keyword === 'tomorrow' ? 1 : 0));
    remainder = remainder.slice(0, dateMatch.index).trim();
  } else {
    const explicit = remainder.match(/\s+(\d{4}-\d{2}-\d{2})$/);
    if (explicit) {
      const candidate = explicit[1];
      const parsed = new Date(candidate + 'T12:00:00');
      if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== candidate) {
        return { error: 'Use a real calendar date in YYYY-MM-DD format.' };
      }
      date = parsed;
      remainder = remainder.slice(0, explicit.index).trim();
    }
  }
  if (!remainder) return { error: 'Add a short description after the amount.' };
  const note = remainder.slice(0, 300);
  const lower = note.toLowerCase();
  const category = /\b(rent|landlord|lease)\b/.test(lower) ? 'Rent'
    : /\b(bus|metro|train|taxi|cab|uber|fuel|petrol|parking|transport)\b/.test(lower) ? 'Transport'
    : /\b(electricity|electric|internet|mobile|bill|water bill)\b/.test(lower) ? 'Bills'
    : /\b(medicine|pharmacy|doctor|clinic|hospital|health)\b/.test(lower) ? 'Health'
    : /\b(movie|cinema|netflix|spotify|concert|game|entertainment)\b/.test(lower) ? 'Entertainment'
    : /\b(shoes|shirt|shopping|store|clothes|amazon)\b/.test(lower) ? 'Shopping'
    : /\b(coffee|food|lunch|dinner|breakfast|snack|grocery|groceries|restaurant|tea)\b/.test(lower) ? 'Food'
    : 'Other';
  return { amount, category, date: date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0'), note };
}
