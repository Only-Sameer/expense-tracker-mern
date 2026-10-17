import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api.js';
import { useDebounced } from '../hooks.js';

const CATEGORIES = ['Food', 'Transport', 'Rent', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Other', 'Education'];
const META = {
  Food: { icon: '🍽', color: '#F59E0B' }, Transport: { icon: '↗', color: '#60A5FA' },
  Rent: { icon: '⌂', color: '#A78BFA' }, Housing: { icon: '⌂', color: '#A78BFA' },
  Shopping: { icon: '◇', color: '#F472B6' }, Bills: { icon: '▤', color: '#38BDF8' },
  Health: { icon: '＋', color: '#FB7185' }, Entertainment: { icon: '♫', color: '#C084FC' },
  Other: { icon: '•••', color: '#94A3B8' }, Education: { icon: '▣', color: '#34D399' }
};
const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const money = n => INR.format(Number(n) || 0);
const today = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
const monthKey = v => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const shiftMonth = (key, n) => { const p = key.split('-').map(Number); const d = new Date(p[0], p[1] - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const monthLabel = key => { const p = key.split('-').map(Number); return new Date(p[0], p[1] - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); };
const dayKey = item => { const d = new Date(item.date); return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10); };
const formatDate = value => { const d = new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
const displayCategory = c => c === 'Housing' ? 'Rent' : c;
const serverCategory = c => c === 'Rent' ? 'Housing' : c;
const itemId = item => String(item?._id || item?.id || '');

function createDemoExpenses() {
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
function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function csvCell(value) {
  let s = String(value ?? '');
  if (/^\s*[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
function parseCsv(input) {
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

function EmptyIllustration({ compact = false }) {
  return <div className={'empty-illustration' + (compact ? ' compact' : '')} aria-hidden="true"><svg viewBox="0 0 180 124">
    <rect x="25" y="17" width="130" height="92" rx="14" fill="currentColor" opacity=".06" />
    <path d="M46 85V55M68 85V42M90 85V63M112 85V31M134 85V49" stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity=".22" />
    <path d="M40 93H142" stroke="currentColor" strokeWidth="2" opacity=".35" /><circle cx="136" cy="28" r="13" fill="#10B981" opacity=".18" />
    <path d="m130 28 4 4 8-9" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg></div>;
}
function Sidebar({ active, onChange, user, demo, onExit }) {
  const links = [['dashboard','▦','Dashboard'],['expenses','≡','Expenses'],['reports','▥','Reports'],['budgets','◴','Budgets'],['settings','⚙','Settings']];
  return <aside className="budgetry-sidebar" aria-label="Primary navigation">
    <p className="sidebar-label">WORKSPACE</p><nav className="sidebar-nav">
      {links.map(([id, icon, label]) => <button key={id} type="button" className={'sidebar-link' + (active === id ? ' is-active' : '')} onClick={() => onChange(id)} aria-current={active === id ? 'page' : undefined}><span aria-hidden="true" className="nav-icon">{icon}</span><span>{label}</span></button>)}
    </nav>
    <div className="sidebar-bottom"><div className="sidebar-prompt"><span>✳</span><strong>Spend with intention</strong><p>Small habits build financial clarity.</p></div>
      {demo && <button className="sidebar-link" type="button" onClick={onExit}><span className="nav-icon">↩</span>Exit demo</button>}
      <div className="sidebar-user"><span className="avatar">{(user?.name || 'B').slice(0,1).toUpperCase()}</span><span><strong>{user?.name || 'Budgetry user'}</strong><small>{demo ? 'Demo workspace' : user?.email}</small></span></div>
    </div>
  </aside>;
}
function StatCard({ label, value, caption, icon, tone = 'green', trend }) {
  return <article className="stat-card"><div className="stat-card-top"><span className={'stat-icon tone-' + tone} aria-hidden="true">{icon}</span><span className="stat-label">{label}</span></div>
    <strong className="stat-value">{value}</strong><div className="stat-caption">{trend && <span className={'trend ' + (trend.good ? 'trend-good' : 'trend-bad')}>{trend.good ? '↘' : '↗'} {trend.text}</span>}{caption}</div>
  </article>;
}
function SpendingChart({ data, year, onYearChange, onAdd }) {
  return <section className="surface-card chart-card"><div className="card-heading"><div><p className="section-kicker">CASH FLOW</p><h2>Monthly spending</h2><p className="muted">Your spending, month by month</p></div>
    <label className="select-label">Year <select aria-label="Select chart year" value={year} onChange={e => onYearChange(Number(e.target.value))}>{Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y}>{y}</option>)}</select></label></div>
    {data.some(x => x.amount > 0) ? <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 12, right: 6, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} /><XAxis dataKey="month" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={v => v >= 1000 ? '₹' + Math.round(v / 1000) + 'k' : '₹' + v} tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={54} /><Tooltip formatter={v => [money(v), 'Spent']} labelStyle={{ color: 'var(--text)' }} contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)' }} /><Bar dataKey="amount" name="Spent" fill="#10B981" radius={[6,6,0,0]} maxBarSize={34} /></BarChart></ResponsiveContainer></div> : <div className="chart-empty"><EmptyIllustration compact /><p>No spending recorded for {year} yet.</p><button className="text-action" onClick={onAdd}>Add your first expense →</button></div>}
  </section>;
}
function CategoryDonut({ data, onAdd }) {
  const dataPresent = data.some(x => x.amount > 0);
  return <section className="surface-card donut-card"><div className="card-heading"><div><p className="section-kicker">WHERE IT GOES</p><h2>Spending by category</h2><p className="muted">This selected month</p></div></div>
    {dataPresent ? <div className="donut-layout"><div className="donut-visual"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="amount" nameKey="category" innerRadius="62%" outerRadius="86%" paddingAngle={3} stroke="none">{data.map(x => <Cell key={x.category} fill={x.color} />)}</Pie><Tooltip formatter={value => money(value)} contentStyle={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)' }} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{money(data.reduce((sum, x) => sum + x.amount, 0))}</strong><span>total spent</span></div></div>
      <div className="donut-legend">{[...data].sort((a,b)=>b.amount-a.amount).slice(0,8).map(x=><div className="legend-row" key={x.category}><span className="legend-dot" style={{background:x.color}} /><span className="legend-name">{x.category}</span><strong>{money(x.amount)}</strong></div>)}</div></div> : <div className="chart-empty"><EmptyIllustration compact /><p>Your category breakdown will appear here.</p><button className="text-action" onClick={onAdd}>Add your first expense →</button></div>}
  </section>;
}
function ExpenseForm({ initialValue, onClose, onSubmit, submitting, error, clearError }) {
  const [form, setForm] = useState(() => initialValue ? ({ amount: String(initialValue.amount ?? ''), category: displayCategory(initialValue.category), date: dayKey(initialValue) || today(), note: initialValue.note || '' }) : ({ amount:'', category:'Food', date:today(), note:'' }));
  const amountRef = useRef(null); const [tried, setTried] = useState(false);
  useEffect(() => { amountRef.current?.focus(); }, []);
  function change(key, value) { setForm(old => ({...old,[key]:value})); if (error) clearError(); }
  const amountOk = form.amount !== '' && Number.isFinite(Number(form.amount)) && Number(form.amount)>0;
  const dt = new Date(form.date + 'T12:00:00');
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(form.date) && !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0,10)===form.date;
  async function submit(e) { e.preventDefault(); setTried(true); if (!amountOk || !dateOk) return; await onSubmit({...form,amount:Number(form.amount)}); }
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title">
    <div className="modal-head"><div><p className="section-kicker">{initialValue?'UPDATE RECORD':'NEW RECORD'}</p><h2 id="expense-modal-title">{initialValue?'Edit expense':'Add an expense'}</h2><p className="muted">A few details, and you’re done.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close form">×</button></div>
    <form onSubmit={submit} noValidate>
      <div className="amount-field"><label htmlFor="expense-amount">Amount <span>(INR ₹)</span></label><div className="amount-input-wrap"><span aria-hidden="true">₹</span><input ref={amountRef} id="expense-amount" type="number" inputMode="decimal" min="0.01" max="100000000" step="0.01" placeholder="0.00" value={form.amount} onChange={e=>change('amount',e.target.value)} aria-invalid={tried&&!amountOk} aria-describedby={tried&&!amountOk?'amount-error':undefined} /></div>{tried&&!amountOk&&<small className="field-error" id="amount-error">Enter an amount greater than ₹0.</small>}</div>
      <fieldset className="category-field"><legend>Category</legend><div className="category-chips">{CATEGORIES.map(c=><button type="button" key={c} className={'category-chip'+(form.category===c?' selected':'')} onClick={()=>change('category',c)} aria-pressed={form.category===c}><span aria-hidden="true">{META[c]?.icon||'•'}</span>{c}</button>)}</div></fieldset>
      <div className="form-two-col"><div className="field"><label htmlFor="expense-date">Date</label><input id="expense-date" type="date" value={form.date} onChange={e=>change('date',e.target.value)} aria-invalid={tried&&!dateOk} required />{tried&&!dateOk&&<small className="field-error">Choose a valid date.</small>}</div><div className="field"><label htmlFor="expense-note">Note <span className="muted">(optional)</span></label><textarea id="expense-note" rows="2" maxLength="300" placeholder="e.g. Groceries for the week" value={form.note} onChange={e=>change('note',e.target.value)} /><small className="character-count">{form.note.length}/300</small></div></div>
      {error&&<p className="inline-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={submitting}>{submitting?'Saving…':initialValue?'Save changes':'Add expense'}</button></div>
    </form>
  </section></div>;
}
function ExpenseTable({ items, onEdit, onDelete, onAdd, onTouchStart, onTouchEnd, swipedId }) {
  if (!items.length) return <div className="list-empty"><EmptyIllustration /><h3>No expenses found</h3><p>Try changing your filters, or add your first expense.</p><button type="button" className="button button-primary" onClick={onAdd}>Add your first expense</button></div>;
  return <><div className="expense-table-wrap"><table className="expense-table"><thead><tr><th scope="col">Expense</th><th scope="col">Category</th><th scope="col">Date</th><th scope="col" className="numeric">Amount</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>
    {items.map(item => {
      const cat=displayCategory(item.category); const meta=META[cat]||META.Other;
      return <tr key={itemId(item)}>
        <td><div className="expense-title"><span className="expense-leading" style={{background:meta.color+'20',color:meta.color}}>{meta.icon}</span><span><strong>{item.note||cat+' expense'}</strong><small>{item.note?cat+' expense':'Added to Budgetry'}</small></span></div></td>
        <td><span className="category-badge" style={{'--category-color':meta.color}}>{cat}</span></td>
        <td>{formatDate(item.date)}</td><td className="numeric amount-cell">{money(item.amount)}</td>
        <td><div className="row-actions"><button type="button" className="text-action" onClick={()=>onEdit(item)} aria-label={'Edit '+(item.note||cat)+' expense'}>Edit</button><button type="button" className="text-action danger-action" onClick={()=>onDelete(item)} aria-label={'Delete '+(item.note||cat)+' expense'}>Delete</button></div></td>
      </tr>;
    })}
  </tbody></table></div><div className="expense-mobile-list">
    {items.map(item=>{const cat=displayCategory(item.category);const meta=META[cat]||META.Other;return <article key={itemId(item)} className={'expense-mobile-card'+(swipedId===itemId(item)?' swiped':'')} onTouchStart={e=>onTouchStart(e,itemId(item))} onTouchEnd={e=>onTouchEnd(e,itemId(item))}>
      <div className="mobile-expense-main"><span className="expense-leading" style={{background:meta.color+'20',color:meta.color}}>{meta.icon}</span><div className="mobile-expense-copy"><strong>{item.note||cat+' expense'}</strong><span className="muted">{cat} · {formatDate(item.date)}</span></div><strong className="mobile-expense-amount">{money(item.amount)}</strong></div>
      <div className="mobile-row-actions"><button type="button" className="text-action" onClick={()=>onEdit(item)}>Edit</button><button type="button" className="text-action danger-action" onClick={()=>onDelete(item)}>Delete</button></div>
    </article>;})}
  </div></>;
}
function BudgetCard({ category, amount, budget, onChange }) {
  const ratio=budget>0?amount/budget:0;const tone=ratio>=1?'over':ratio>=.8?'warning':'under';const meta=META[category]||META.Other;
  return <article className="budget-category-card"><div className="budget-category-head"><span className="expense-leading" style={{background:meta.color+'20',color:meta.color}}>{meta.icon}</span><div className="budget-category-name"><strong>{category}</strong><span className="muted">{money(amount)} spent</span></div><div className="budget-limit-field"><label htmlFor={'budget-'+category} className="sr-only">Monthly budget for {category}</label><span>₹</span><input id={'budget-'+category} type="number" min="0" step="500" value={budget||''} placeholder="Set limit" onChange={e=>onChange(category,Math.max(0,Number(e.target.value)||0))}/></div></div><div className="budget-track budget-track-large"><span className={'budget-fill '+tone} style={{width:Math.min(100,ratio*100)+'%'}}/></div><div className="budget-foot"><span className={'budget-status '+tone}>{budget<=0?'Set a limit':ratio>=1?'Over budget':ratio>=.8?'Near limit':'On track'}</span><span>{budget>0?Math.round(ratio*100)+'% of '+money(budget):'No budget set'}</span></div></article>;
}
function SettingsPage({ user, demo, onDelete, onImport, onCsv, onJson, onThemeToggle, theme }) {
  const [confirming,setConfirming]=useState(false);const [typed,setTyped]=useState('');const fileRef=useRef(null);
  return <div className="view-stack"><div className="page-title-block"><p className="section-kicker">PREFERENCES</p><h1>Settings</h1><p className="muted">Manage your appearance, data, and account.</p></div>
    <section className="surface-card settings-section"><div><p className="section-kicker">APPEARANCE</p><h2>Theme</h2><p className="muted">Follows your system setting by default. You can switch any time.</p></div><div className="theme-control"><span>{theme==='dark'?'🌙 Dark mode':'☀ Light mode'}</span><button type="button" className={'switch-control'+(theme==='dark'?' on':'')} onClick={onThemeToggle} role="switch" aria-checked={theme==='dark'} aria-label="Toggle theme"><span/></button></div></section>
    <section className="surface-card settings-section"><div><p className="section-kicker">YOUR DATA</p><h2>Import and export</h2><p className="muted">Keep a backup or bring expense records from a spreadsheet. CSV needs Date, Amount, and Category columns; Note is optional.</p></div><div className="settings-actions"><button className="button button-secondary" type="button" onClick={onCsv}>↓ Export CSV</button><button className="button button-secondary" type="button" onClick={onJson}>↓ Export JSON</button><button className="button button-secondary" type="button" onClick={()=>fileRef.current?.click()}>↑ Import CSV</button><input ref={fileRef} type="file" accept=".csv,text/csv" hidden aria-label="Choose CSV file to import" onChange={e=>{const file=e.target.files?.[0];if(file)onImport(file);e.target.value='';}}/></div></section>
    <section className="surface-card settings-section account-settings"><span className="avatar settings-avatar">{(user?.name||'B').slice(0,1).toUpperCase()}</span><div className="settings-account-copy"><p className="section-kicker">ACCOUNT</p><h2>{user?.name||'Demo profile'}</h2><p className="muted">{demo?'Demo data is local to this session.':user?.email}</p></div></section>
    <section className="surface-card danger-zone"><div><p className="section-kicker danger-kicker">DANGER ZONE</p><h2>Delete account</h2><p className="muted">Permanently remove your account and saved expenses. Type DELETE to confirm.</p></div><button type="button" className="button button-danger" onClick={()=>{setTyped('');setConfirming(true);}}>Delete account</button></section>
    {confirming&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setConfirming(false);}}><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><span className="danger-icon" aria-hidden="true">!</span><h2 id="delete-title">{demo?'End demo session?':'Delete your account?'}</h2><p>{demo?'Exit demo mode and remove the sample workspace from this view.':'This permanently removes your account and all associated expenses. There is no undo for account deletion.'}</p><p>Type <strong>DELETE</strong> below to confirm.</p><label htmlFor="confirm-delete">Confirmation</label><input id="confirm-delete" autoFocus value={typed} onChange={e=>setTyped(e.target.value)} placeholder="Type DELETE" autoComplete="off"/><div className="modal-actions"><button className="button button-quiet" onClick={()=>setConfirming(false)}>Cancel</button><button className="button button-danger" disabled={typed!=='DELETE'} onClick={async()=>{setConfirming(false);await onDelete();}}>Delete permanently</button></div></section></div>}
  </div>;
}

export default function Dashboard({ user, setUser, onThemeToggle, theme }) {
  const [demoMode,setDemoMode]=useState(false);const [expenses,setExpenses]=useState([]);const [loading,setLoading]=useState(Boolean(user));const [loadError,setLoadError]=useState('');
  const [active,setActive]=useState('dashboard');const [selectedMonth,setSelectedMonth]=useState(monthKey(new Date()));const [chartYear,setChartYear]=useState(new Date().getFullYear());
  const [search,setSearch]=useState('');const debouncedSearch=useDebounced(search);const [categoryFilter,setCategoryFilter]=useState('All');const [from,setFrom]=useState('');const [to,setTo]=useState('');const [sort,setSort]=useState('date_desc');const [page,setPage]=useState(1);const pageSize=8;
  const [formOpen,setFormOpen]=useState(false);const [editing,setEditing]=useState(null);const [saving,setSaving]=useState(false);const [formError,setFormError]=useState('');const [toast,setToast]=useState('');const [pending,setPending]=useState(null);const pendingRef=useRef(null);const searchRef=useRef(null);const fileRef=useRef(null);const [swipedId,setSwipedId]=useState('');
  const [budgets,setBudgets]=useState(()=>{try{return JSON.parse(localStorage.getItem('budgetry-budgets')||'{}');}catch{return{};}});
  const [recurring,setRecurring]=useState(()=>{try{return JSON.parse(localStorage.getItem('budgetry-recurring')||'[]');}catch{return[];}});
  const [recurringDraft,setRecurringDraft]=useState({name:'',amount:'',category:'Rent',day:'1'});
  const isDemo=demoMode&&!user;const activeUser=user||(isDemo?{name:'Alex Morgan',email:'demo@budgetry.app'}:null);

  useEffect(()=>{
    if(!user||isDemo){setLoading(false);if(!user&&!isDemo)setExpenses([]);return;}
    let cancelled=false;
    async function loadAll(){setLoading(true);setLoadError('');try{
      const first=await api('/expenses?page=1&limit=100&sort=date_desc');let all=first.items||[];const pages=Math.min(Number(first.pages)||1,250);
      for(let start=2;start<=pages;start+=8){const batch=await Promise.all(Array.from({length:Math.min(8,pages-start+1)},(_,i)=>api('/expenses?page='+(start+i)+'&limit=100&sort=date_desc')));all=all.concat(...batch.map(x=>x.items||[]));}
      if(!cancelled)setExpenses(all);
    }catch(e){if(!cancelled)setLoadError(e.message||'Could not load expenses.');}finally{if(!cancelled)setLoading(false);}}
    loadAll();return()=>{cancelled=true;};
  },[user,isDemo]);

  useEffect(()=>{try{localStorage.setItem('budgetry-budgets',JSON.stringify(budgets));localStorage.setItem('budgetry-recurring',JSON.stringify(recurring));}catch{/* Storage is optional. */}},[budgets,recurring]);
  useEffect(()=>{if(!toast)return;const id=window.setTimeout(()=>setToast(''),3200);return()=>window.clearTimeout(id);},[toast]);
  useEffect(()=>{setPage(1);},[debouncedSearch,categoryFilter,from,to,sort,selectedMonth]);
  useEffect(()=>{
    function keydown(e){const t=e.target;const typing=t instanceof HTMLElement&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));if(e.key==='Escape'){setFormOpen(false);setEditing(null);return;}if(typing||e.metaKey||e.ctrlKey||e.altKey)return;if(e.key.toLowerCase()==='n'){e.preventDefault();setEditing(null);setFormError('');setFormOpen(true);}if(e.key==='/'){e.preventDefault();setActive('expenses');window.setTimeout(()=>searchRef.current?.focus(),0);}}
    window.addEventListener('keydown',keydown);return()=>window.removeEventListener('keydown',keydown);
  },[]);

  const monthItems=useMemo(()=>expenses.filter(x=>monthKey(x.date)===selectedMonth),[expenses,selectedMonth]);
  const previousItems=useMemo(()=>expenses.filter(x=>monthKey(x.date)===shiftMonth(selectedMonth,-1)),[expenses,selectedMonth]);
  const total=useMemo(()=>monthItems.reduce((s,x)=>s+Number(x.amount||0),0),[monthItems]);
  const previousTotal=useMemo(()=>previousItems.reduce((s,x)=>s+Number(x.amount||0),0),[previousItems]);
  const change=previousTotal>0?Math.round((total-previousTotal)/previousTotal*100):null;
  const grouped=useMemo(()=>{const m=new Map();monthItems.forEach(x=>{const c=displayCategory(x.category);m.set(c,(m.get(c)||0)+Number(x.amount||0));});return [...m.entries()].sort((a,b)=>b[1]-a[1]);},[monthItems]);
  const topCategory=grouped[0]||null;
  const daysInMonth=new Date(Number(selectedMonth.slice(0,4)),Number(selectedMonth.slice(5,7)),0).getDate();
  const avgDaily=total/(selectedMonth===monthKey(new Date())?new Date().getDate():daysInMonth);
  const donutData=grouped.map(([category,amount])=>({category,amount,color:(META[category]||META.Other).color}));
  const monthlyData=Array.from({length:12},(_,i)=>{const key=chartYear+'-'+String(i+1).padStart(2,'0');return{month:new Date(chartYear,i,1).toLocaleDateString('en-IN',{month:'short'}),amount:expenses.filter(x=>monthKey(x.date)===key).reduce((s,x)=>s+Number(x.amount||0),0)};});
  const filtered=useMemo(()=>{const q=debouncedSearch.trim().toLowerCase();return expenses.filter(x=>{const cat=displayCategory(x.category);if(q&&!(String(x.note||'').toLowerCase().includes(q)||cat.toLowerCase().includes(q)))return false;if(categoryFilter!=='All'&&cat!==categoryFilter)return false;const d=dayKey(x);if(from&&d<from)return false;if(to&&d>to)return false;return true;}).sort((a,b)=>sort==='amount_asc'?Number(a.amount)-Number(b.amount):sort==='amount_desc'?Number(b.amount)-Number(a.amount):sort==='date_asc'?new Date(a.date)-new Date(b.date):new Date(b.date)-new Date(a.date));},[expenses,debouncedSearch,categoryFilter,from,to,sort]);
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize));const currentItems=filtered.slice((page-1)*pageSize,page*pageSize);
  const recurringDetected=useMemo(()=>{const m=new Map();expenses.filter(x=>/(rent|emi|subscription|netflix|spotify|insurance|internet)/i.test(x.note||'')||displayCategory(x.category)==='Rent').forEach(x=>{const k=(x.note||displayCategory(x.category)).toLowerCase().trim();const v=m.get(k)||{name:x.note||displayCategory(x.category),amount:0,count:0};v.amount+=Number(x.amount||0);v.count+=1;m.set(k,v);});return[...m.values()].filter(x=>x.count>=2).slice(0,4);},[expenses]);
  const insight=useMemo(()=>{const old=new Map();previousItems.forEach(x=>{const c=displayCategory(x.category);old.set(c,(old.get(c)||0)+Number(x.amount||0));});for(const [c,v] of grouped){const p=old.get(c)||0;if(p>0&&v>p*1.1)return'You spent '+Math.round((v-p)/p*100)+'% more on '+c+' than last month.';}if(total>0&&previousTotal>0&&total<previousTotal)return'Nice work — your total spending is down '+Math.round((previousTotal-total)/previousTotal*100)+'% from last month.';return'A little awareness each day can make your monthly spending easier to manage.';},[previousItems,grouped,total,previousTotal]);

  function openAdd(){setEditing(null);setFormError('');setFormOpen(true);}
  function enterDemo(){setExpenses(createDemoExpenses());setDemoMode(true);setActive('dashboard');setSelectedMonth(monthKey(new Date()));setToast('Demo ready — explore 60 sample expenses.');}
  function exitDemo(){setDemoMode(false);setExpenses([]);setActive('dashboard');setToast('Demo session ended.');}
  function go(view){setActive(view);if(view==='expenses')window.setTimeout(()=>searchRef.current?.focus(),50);}
  async function saveExpense(form){setSaving(true);setFormError('');try{const payload={...form,category:serverCategory(form.category),amount:Number(form.amount),note:form.note.trim()};
    if(isDemo){if(editing)setExpenses(items=>items.map(x=>itemId(x)===itemId(editing)?{...x,...payload,_id:itemId(editing)}:x));else setExpenses(items=>[{...payload,_id:'demo-new-'+Date.now()},...items]);}
    else{const result=editing?await api('/expenses/'+itemId(editing),{method:'PATCH',body:JSON.stringify(payload)}):await api('/expenses',{method:'POST',body:JSON.stringify(payload)});if(editing)setExpenses(items=>items.map(x=>itemId(x)===itemId(editing)?result.item:x));else setExpenses(items=>[result.item,...items]);}
    setFormOpen(false);setEditing(null);setToast(editing?'Expense updated successfully.':'Expense added successfully.');
  }catch(e){setFormError(e.message||'Could not save this expense.');}finally{setSaving(false);}}
  async function finalizeDelete(item){if(!isDemo){try{await api('/expenses/'+itemId(item),{method:'DELETE'});setToast('Expense deleted.');}catch(e){setExpenses(items=>[item,...items]);setToast(e.message||'Delete failed. Expense restored.');}}else setToast('Sample expense removed.');if(pendingRef.current&&itemId(pendingRef.current.item)===itemId(item)){pendingRef.current=null;setPending(null);}}
  function deleteExpense(item){const old=pendingRef.current;if(old){window.clearTimeout(old.timer);finalizeDelete(old.item);}setExpenses(items=>items.filter(x=>itemId(x)!==itemId(item)));const timer=window.setTimeout(()=>finalizeDelete(item),5000);pendingRef.current={item,timer};setPending(item);}
  function undoDelete(){const p=pendingRef.current;if(!p)return;window.clearTimeout(p.timer);setExpenses(items=>[p.item,...items]);pendingRef.current=null;setPending(null);setToast('Delete undone.');}
  async function exportCsv(){try{if(!isDemo){const blob=await api('/expenses/csv');const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='budgetry-expenses.csv';a.click();URL.revokeObjectURL(url);}else{const rows=[['Date','Amount','Category','Note'],...expenses.map(x=>[dayKey(x),x.amount,displayCategory(x.category),x.note||''])];downloadFile('budgetry-expenses.csv',rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');}setToast('CSV export downloaded.');}catch(e){setToast(e.message||'CSV export failed.');}}
  async function exportJson(){try{const data=isDemo?{exportedAt:new Date().toISOString(),user:activeUser,expenses}:await api('/auth/export');downloadFile('budgetry-data.json',JSON.stringify(data,null,2),'application/json');setToast('JSON export downloaded.');}catch(e){setToast(e.message||'JSON export failed.');}}
  async function importCsv(file){try{const rows=parseCsv(await file.text());if(rows.length<2)throw new Error('This CSV has no expense rows.');const heads=rows[0].map(s=>s.trim().toLowerCase());const ix={date:heads.indexOf('date'),amount:heads.indexOf('amount'),category:heads.indexOf('category'),note:heads.indexOf('note')};if(ix.date<0||ix.amount<0||ix.category<0)throw new Error('CSV needs Date, Amount, and Category columns.');const parsed=rows.slice(1).map((r,i)=>{const d=String(r[ix.date]||'').trim().slice(0,10);const value=Number(String(r[ix.amount]||'').replace(/[₹,\s]/g,''));const c=displayCategory(String(r[ix.category]||'').trim());const dt=new Date(d+'T12:00:00');if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||Number.isNaN(dt.getTime())||dt.toISOString().slice(0,10)!==d)throw new Error('Row '+(i+2)+': use a valid YYYY-MM-DD date.');if(!Number.isFinite(value)||value<=0)throw new Error('Row '+(i+2)+': amount must be greater than zero.');if(!CATEGORIES.includes(c))throw new Error('Row '+(i+2)+': unknown category "'+c+'".');return{date:d,amount:value,category:serverCategory(c),note:String(r[ix.note]||'').trim().slice(0,300)};});if(parsed.length>250)throw new Error('Import is limited to 250 rows at a time.');if(isDemo)setExpenses(items=>[...parsed.map((x,i)=>({...x,_id:'demo-import-'+Date.now()+'-'+i,category:displayCategory(x.category)})),...items]);else{const newItems=[];for(const row of parsed){const response=await api('/expenses',{method:'POST',body:JSON.stringify(row)});newItems.push(response.item);}setExpenses(items=>[...newItems,...items]);}setToast('Imported '+parsed.length+' expense'+(parsed.length===1?'':'s')+'.');}catch(e){setToast(e.message||'CSV import failed.');}}
  async function deleteAccount(){if(isDemo){exitDemo();return;}try{await api('/auth/account',{method:'DELETE'});setUser(null);setExpenses([]);setToast('Your account was deleted.');}catch(e){setToast(e.message||'Could not delete account.');}}
  function addRecurring(e){e.preventDefault();const value=Number(recurringDraft.amount);if(!recurringDraft.name.trim()||!Number.isFinite(value)||value<=0){setToast('Enter a name and a valid amount.');return;}setRecurring(items=>[...items,{id:'r-'+Date.now(),...recurringDraft,amount:value}]);setRecurringDraft({name:'',amount:'',category:'Rent',day:'1'});setToast('Recurring expense saved on this device.');}

  const addButton=<button type="button" className="button button-primary" onClick={openAdd}>＋ Add expense</button>;
  const editExpense=item=>{setEditing(item);setFormError('');setFormOpen(true);};
  const deleteAndToast=item=>deleteExpense(item);
  const chartAdd=()=>openAdd();
  const pageNumbers=Array.from({length:pageCount},(_,i)=>i+1).filter(n=>n>=Math.max(1,page-2)&&n<=Math.min(pageCount,page+2));

  const main = <div className="dashboard-layout">
    <Sidebar active={active} onChange={go} user={activeUser} demo={isDemo} onExit={exitDemo}/>
    <div className="dashboard-main">
      {isDemo&&<div className="demo-banner"><span>✳ You’re exploring sample data.</span><button type="button" onClick={exitDemo}>Exit demo</button></div>}
      {active==='dashboard'&&<div className="view-stack">
        <section className="dashboard-page-header"><div><p className="section-kicker">YOUR FINANCIAL SNAPSHOT</p><h1>Good {new Date().getHours()<12?'morning':new Date().getHours()<18?'afternoon':'evening'}, {activeUser?.name?.split(' ')[0]||'there'} <span className="greeting-spark">✳</span></h1><p className="muted">Know where your money goes.</p></div><div className="header-controls"><label className="month-selector"><span className="sr-only">Select dashboard month</span><input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} aria-label="Select dashboard month"/></label>{addButton}</div></section>
        {loadError&&<div className="error-banner" role="alert"><span>{loadError}</span><button className="button button-secondary" onClick={()=>window.location.reload()}>Retry</button></div>}
        {loading?<div className="stat-grid">{[1,2,3,4].map(i=><div className="stat-card skeleton-card" key={i}><span/><span/><span/></div>)}</div>:<>
          <section className="stat-grid" aria-label="Monthly summary"><StatCard label="Total spent this month" value={money(total)} caption={monthLabel(selectedMonth)} icon="₹" tone="green"/>
            <StatCard label="Change vs last month" value={change===null?'—':Math.abs(change)+'%'} caption={change===null?'Add last month’s data to compare':change>0?'More than last month':change<0?'Less than last month':'Same as last month'} icon={change!==null&&change<=0?'↘':'↗'} tone={change!==null&&change<=0?'green':'red'} trend={change===null?null:{good:change<=0,text:(change>0?'+':'')+change+'%'}}/>
            <StatCard label="Top spending category" value={topCategory?topCategory[0]:'—'} caption={topCategory?money(topCategory[1])+' this month':'Your leading category appears here'} icon={topCategory?(META[topCategory[0]]||META.Other).icon:'◈'} tone="blue"/>
            <StatCard label="Daily average spend" value={money(avgDaily)} caption="Average per calendar day" icon="↗" tone="purple"/>
          </section>
          <section className="charts-grid"><SpendingChart data={monthlyData} year={chartYear} onYearChange={setChartYear} onAdd={chartAdd}/><CategoryDonut data={donutData} onAdd={chartAdd}/></section>
          <section className="surface-card insight-card"><span className="insight-orb" aria-hidden="true">✳</span><div><p className="section-kicker">A LITTLE INSIGHT</p><p>{insight}</p></div><button type="button" className="text-action" onClick={()=>go('reports')}>View report →</button></section>
          <section className="surface-card recent-expenses-card"><div className="card-heading"><div><p className="section-kicker">LATEST ACTIVITY</p><h2>Recent expenses</h2><p className="muted">Your most recent transactions</p></div><button type="button" className="button button-secondary" onClick={()=>go('expenses')}>View all expenses</button></div>
            <ExpenseTable items={[...expenses].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5)} onEdit={editExpense} onDelete={deleteAndToast} onAdd={openAdd} swipedId={swipedId} onTouchStart={()=>{}} onTouchEnd={()=>{}}/>
          </section>
        </>}
      </div>}
      {active==='expenses'&&<div className="view-stack"><div className="page-title-row"><div className="page-title-block"><p className="section-kicker">TRANSACTION HISTORY</p><h1>Expenses</h1><p className="muted">Search, filter, edit, and organize your expenses.</p></div>{addButton}</div>
        <section className="surface-card expenses-view-card"><div className="expense-toolbar"><div className="search-box"><span aria-hidden="true">⌕</span><label className="sr-only" htmlFor="expense-search">Search expenses by note or category</label><input id="expense-search" ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search notes or categories"/><kbd>/</kbd></div><label className="sort-label">Sort by <select value={sort} onChange={e=>setSort(e.target.value)}><option value="date_desc">Newest first</option><option value="date_asc">Oldest first</option><option value="amount_desc">Amount: high to low</option><option value="amount_asc">Amount: low to high</option></select></label></div>
          <div className="filters-row"><label className="filter-select">Category<select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option>All</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label><label className="filter-select">From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="filter-select">To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>{(categoryFilter!=='All'||from||to||search)&&<button type="button" className="filter-clear" onClick={()=>{setCategoryFilter('All');setFrom('');setTo('');setSearch('');}}>Clear filters ×</button>}</div>
          <div className="active-filter-chips">{categoryFilter!=='All'&&<button type="button" onClick={()=>setCategoryFilter('All')}>{categoryFilter} ×</button>}{from&&<button type="button" onClick={()=>setFrom('')}>From {from} ×</button>}{to&&<button type="button" onClick={()=>setTo('')}>To {to} ×</button>}</div>
          {loading?<div className="skeleton-table"><div/><div/><div/><div/><div/></div>:<><div className="expense-results-label">{filtered.length.toLocaleString('en-IN')} results <span>· {money(filtered.reduce((s,x)=>s+Number(x.amount||0),0))} filtered total</span></div><ExpenseTable items={currentItems} onEdit={editExpense} onDelete={deleteAndToast} onAdd={openAdd} swipedId={swipedId} onTouchStart={(e,id)=>{e.currentTarget.dataset.touchStart=String(e.touches[0].clientX);}} onTouchEnd={(e,id)=>{const start=Number(e.currentTarget.dataset.touchStart);if(start-e.changedTouches[0].clientX>65)setSwipedId(id);else if(e.changedTouches[0].clientX-start>65)setSwipedId('');}}/></>}
          {filtered.length>0&&<div className="pagination-bar"><span className="muted">Showing {(page-1)*pageSize+1}–{Math.min(page*pageSize,filtered.length)} of {filtered.length}</span><div className="page-buttons"><button type="button" className="button button-secondary" disabled={page<=1} onClick={()=>setPage(p=>p-1)} aria-label="Previous page">←</button>{pageNumbers.map(n=><button type="button" key={n} className={'page-number'+(n===page?' current':'')} onClick={()=>setPage(n)} aria-label={'Page '+n} aria-current={n===page?'page':undefined}>{n}</button>)}<button type="button" className="button button-secondary" disabled={page>=pageCount} onClick={()=>setPage(p=>p+1)} aria-label="Next page">→</button></div></div>}
        </section><div className="inline-data-actions"><button className="button button-secondary" onClick={exportCsv}>↓ Export CSV</button><button className="button button-secondary" onClick={exportJson}>↓ Export JSON</button><button className="button button-secondary" onClick={()=>fileRef.current?.click()}>↑ Import CSV</button><input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={e=>{const file=e.target.files?.[0];if(file)importCsv(file);e.target.value='';}}/></div>
      </div>}
      {active==='reports'&&<div className="view-stack"><div className="page-title-block"><p className="section-kicker">YOUR SPENDING PATTERNS</p><h1>Reports</h1><p className="muted">Understand the story behind your money.</p></div><section className="charts-grid"><SpendingChart data={monthlyData} year={chartYear} onYearChange={setChartYear} onAdd={chartAdd}/><CategoryDonut data={donutData} onAdd={chartAdd}/></section><section className="surface-card report-summary"><h2>Monthly summary · {monthLabel(selectedMonth)}</h2><div className="report-summary-grid"><div><span>Total spent</span><strong>{money(total)}</strong></div><div><span>Average daily spend</span><strong>{money(avgDaily)}</strong></div><div><span>Transactions</span><strong>{monthItems.length}</strong></div></div><div className="report-insight"><span className="insight-orb">✳</span><p>{insight}</p></div></section></div>}
      {active==='budgets'&&<div className="view-stack"><div className="page-title-block"><p className="section-kicker">PLAN AHEAD</p><h1>Budgets & recurring</h1><p className="muted">Set category limits. See your runway before you overspend.</p></div>
        <section className="surface-card budget-panel"><div className="card-heading"><div><p className="section-kicker">MONTHLY LIMITS</p><h2>Category budgets</h2><p className="muted">{monthLabel(selectedMonth)}</p></div><strong className="budget-month-total">{money(total)} <small>spent</small></strong></div><div className="budget-grid">{CATEGORIES.filter(c=>c!=='Education').map(c=><BudgetCard key={c} category={c} amount={monthItems.filter(x=>displayCategory(x.category)===c).reduce((s,x)=>s+Number(x.amount||0),0)} budget={Number(budgets[c])||0} onChange={(key,value)=>setBudgets(old=>({...old,[key]:value}))}/>)}</div></section>
        <section className="surface-card recurring-panel"><div className="card-heading"><div><p className="section-kicker">REPEATED COMMITMENTS</p><h2>Recurring expenses</h2><p className="muted">Keep rent, subscriptions, and EMIs on your radar.</p></div></div><form className="recurring-form" onSubmit={addRecurring}><div className="field"><label htmlFor="rec-name">Expense name</label><input id="rec-name" value={recurringDraft.name} onChange={e=>setRecurringDraft({...recurringDraft,name:e.target.value})} placeholder="e.g. Music subscription" maxLength={80}/></div><div className="field"><label htmlFor="rec-amount">Monthly amount (₹)</label><input id="rec-amount" type="number" min="1" value={recurringDraft.amount} onChange={e=>setRecurringDraft({...recurringDraft,amount:e.target.value})} placeholder="499"/></div><div className="field"><label htmlFor="rec-cat">Category</label><select id="rec-cat" value={recurringDraft.category} onChange={e=>setRecurringDraft({...recurringDraft,category:e.target.value})}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div><div className="field"><label htmlFor="rec-day">Due day</label><select id="rec-day" value={recurringDraft.day} onChange={e=>setRecurringDraft({...recurringDraft,day:e.target.value})}>{Array.from({length:28},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</select></div><button className="button button-primary" type="submit">＋ Add recurring</button></form>
          <div className="recurring-list">{recurring.map(x=><div className="recurring-row" key={x.id}><span className="expense-leading">{(META[x.category]||META.Other).icon}</span><div><strong>{x.name}</strong><span className="muted">{x.category} · Due day {x.day}</span></div><strong>{money(x.amount)}<small>/mo</small></strong><button type="button" className="icon-button danger-action" onClick={()=>setRecurring(old=>old.filter(y=>y.id!==x.id))} aria-label={'Remove recurring expense '+x.name}>×</button></div>)}
          {recurringDetected.length>0&&<div className="recurring-detected"><p className="section-kicker">DETECTED IN YOUR HISTORY</p>{recurringDetected.map(x=><div className="recurring-row" key={x.name}><span className="expense-leading">↻</span><div><strong>{x.name}</strong><span className="muted">Seen {x.count} times</span></div><strong>{money(x.amount/x.count)}<small>/entry</small></strong></div>)}</div>}
          {!recurring.length&&!recurringDetected.length&&<p className="muted recurring-empty">No recurring expenses added yet. Start with rent, subscriptions, or EMIs.</p>}</div>
        </section></div>}
      {active==='settings'&&<SettingsPage user={activeUser} demo={isDemo} onDelete={deleteAccount} onImport={importCsv} onCsv={exportCsv} onJson={exportJson} onThemeToggle={onThemeToggle} theme={theme}/>}
    </div>
    <nav className="mobile-bottom-nav" aria-label="Bottom navigation">{[['dashboard','▦','Home'],['expenses','≡','Expenses'],['reports','▥','Reports'],['budgets','◴','Budgets'],['settings','⚙','Settings']].map(([id,icon,label])=><button key={id} type="button" className={active===id?'active':''} onClick={()=>go(id)} aria-current={active===id?'page':undefined}><span aria-hidden="true">{icon}</span><small>{label}</small></button>)}</nav>
    <button type="button" className="mobile-fab" aria-label="Add expense" onClick={openAdd}>＋</button>
    {formOpen&&<ExpenseForm key={editing?itemId(editing):'new'} initialValue={editing} onClose={()=>{setFormOpen(false);setEditing(null);setFormError('');}} onSubmit={saveExpense} submitting={saving} error={formError} clearError={setFormError}/>}
    {toast&&<div className="toast-message" role="status"><span>{toast}</span><button type="button" aria-label="Dismiss notification" onClick={()=>setToast('')}>×</button></div>}
    {pending&&<div className="undo-snackbar" role="status"><span>Expense hidden temporarily.</span><button type="button" onClick={undoDelete}>Undo</button></div>}
    {loading&&<div className="sr-only" role="status">Loading expenses…</div>}
  </div>;

  if(!activeUser)return <section className="public-home"><div className="public-home-copy"><span className="eyebrow">PERSONAL FINANCE, MADE CLEAR</span><h1>Know where your money <span>goes.</span></h1><p>One calm place to track everyday spending, understand monthly patterns, and build better habits with your money.</p><div className="hero-actions"><a href="/signup" className="button button-primary">Create free account ↗</a><a href="/login" className="button button-secondary">Sign in</a><button type="button" className="button button-quiet" onClick={enterDemo}>Try demo data</button></div><div className="public-trust-row"><span>✓ Private expense records</span><span>✓ Monthly charts</span><span>✓ Export when you need it</span></div></div>
    <div className="public-home-preview"><div className="preview-float preview-float-one">↗ <span><small>Track everyday spending</small><strong>₹1,24,580</strong></span></div><div className="public-mini-card"><div className="public-mini-top"><span className="preview-dot"/>BUDGETRY OVERVIEW</div><div className="public-mini-total">₹24,560<span>this month</span></div><div className="public-mini-chart">{[35,60,44,77,52,90,61].map((h,i)=><span key={i} style={{height:h+'%'}}/>)}</div><div className="public-mini-note"><span className="preview-dot"/>Know where your money goes.</div></div><div className="preview-float preview-float-two">✳ <span><small>More clarity</small><strong>One day at a time</strong></span></div></div>
    <div className="public-home-features"><article><span>01 / TRACK</span><h2>Keep the details tidy</h2><p>Add, search, sort, and categorize every expense in seconds.</p></article><article><span>02 / UNDERSTAND</span><h2>See the bigger picture</h2><p>Monthly charts and category breakdowns make patterns visible.</p></article><article><span>03 / STAY READY</span><h2>Make a plan that fits</h2><p>Set category budgets, organize recurring costs, and export your data.</p></article></div></section>;
  return <>{main}</>;
}
