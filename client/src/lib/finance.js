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
export const monthKey = v => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
export const shiftMonth = (key, n) => { const p = key.split('-').map(Number); const d = new Date(p[0], p[1] - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
export const monthLabel = key => { const p = key.split('-').map(Number); return new Date(p[0], p[1] - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); };
export const dayKey = item => { const d = new Date(item.date); return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10); };
export const formatDate = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
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
