import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api.js';
import { useDebounced } from '../hooks.js';

const categories = ['Food','Transport','Education','Housing','Health','Shopping','Bills','Entertainment','Other'];
const blank = () => ({ amount: '', category: 'Food', date: new Date().toISOString().slice(0,10), note: '' });
const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);
export default function Dashboard({ user, setUser }) {
  const location = useLocation(); const navigate = useNavigate();
  const [demoBudget, setDemoBudget] = useState(30000);
  const demoSpend = 18750;
  const params = new URLSearchParams(location.search);
  const [expenses, setExpenses] = useState([]); const [summary, setSummary] = useState([]);
  const [total, setTotal] = useState(0); const [pages, setPages] = useState(1); const [page, setPage] = useState(1);
  const [search, setSearch] = useState(params.get('search') || ''); const debouncedSearch = useDebounced(search);
  const [category, setCategory] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [sort, setSort] = useState('date_desc'); const [form, setForm] = useState(blank()); const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [feedback, setFeedback] = useState('');
  const [year, setYear] = useState(new Date().getFullYear()); const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [siteSearchResults, setSiteSearchResults] = useState(null);
  useEffect(() => { setSearch(new URLSearchParams(location.search).get('search') || ''); }, [location.search]);
  useEffect(() => { setPage(1); }, [debouncedSearch, category, from, to, sort]);
  useEffect(() => {
    let cancelled = false; setLoading(true); setError('');
    const query = new URLSearchParams({ page, limit: 8, sort });
    if (debouncedSearch) query.set('search', debouncedSearch);
    if (category) query.set('category', category);
    if (from) query.set('from', from); if (to) query.set('to', to);
    api(`/expenses?${query}`).then(data => { if (!cancelled) { setExpenses(data.items); setTotal(data.total); setPages(Math.max(1, data.pages)); } })
      .catch(e => { if (!cancelled) { setError(e.message); if (/sign in|session/i.test(e.message)) { setUser(null); } } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, debouncedSearch, category, from, to, sort, setUser]);
  useEffect(() => { api(`/expenses/summary/monthly?year=${year}`).then(d => setSummary(d.months)).catch(() => setSummary([])); }, [year, expenses.length]);
  useEffect(() => {
    if (!debouncedSearch) { setSiteSearchResults(null); return; }
    const q = debouncedSearch.toLowerCase();
    const sections = [{ label: 'Privacy Policy', path: '/privacy', terms: 'privacy data deletion personal information' }, { label: 'Terms and Conditions', path: '/terms', terms: 'terms conditions use service' }, { label: 'Cookie Policy', path: '/cookies', terms: 'cookies storage preferences consent' }];
    setSiteSearchResults(sections.filter(s => (s.label + ' ' + s.terms).toLowerCase().includes(q)));
  }, [debouncedSearch]);
  const visibleTotal = useMemo(() => expenses.reduce((sum, item) => sum + item.amount, 0), [expenses]);
  function resetForm() { setForm(blank()); setEditing(null); setError(''); }
  async function submit(event) {
    event.preventDefault(); if (saving) return;
    setError(''); setFeedback('');
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter an amount greater than zero.'); return; }
    const [dateYear, dateMonth, dateDay] = form.date.split('-').map(Number);
    const parsedDate = new Date(Date.UTC(dateYear, dateMonth - 1, dateDay));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== form.date) { setError('Choose a valid date.'); return; }
    setSaving(true);
    try {
      const payload = { ...form, amount, date: new Date(`${form.date}T00:00:00.000Z`).toISOString() };
      if (editing) await api(`/expenses/${editing}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await api('/expenses', { method: 'POST', body: JSON.stringify(payload) });
      setFeedback(editing ? 'Expense updated.' : 'Expense added.'); resetForm();
      // Trigger list refresh without relying on a stale state closure.
      setPage(p => p); const query = new URLSearchParams({ page, limit: 8, sort });
      if (debouncedSearch) query.set('search', debouncedSearch); if (category) query.set('category', category);
      if (from) query.set('from', from); if (to) query.set('to', to);
      const fresh = await api(`/expenses?${query}`); setExpenses(fresh.items); setTotal(fresh.total); setPages(Math.max(1, fresh.pages));
      const chart = await api(`/expenses/summary/monthly?year=${year}`); setSummary(chart.months);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  function edit(item) { setEditing(item._id); setForm({ amount: String(item.amount), category: item.category, date: new Date(item.date).toISOString().slice(0,10), note: item.note || '' }); document.getElementById('expense-form-title')?.focus(); }
  async function remove(id) {
    if (!window.confirm('Delete this expense? This cannot be undone.')) return;
    try { await api(`/expenses/${id}`, { method: 'DELETE' }); setExpenses(items => items.filter(e => e._id !== id)); setTotal(t => Math.max(0,t-1)); setFeedback('Expense deleted.'); }
    catch (e) { setError(e.message); }
  }
  async function exportCsv() {
    try { const blob = await api('/expenses/csv'); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'expenses.csv'; a.click(); URL.revokeObjectURL(url); setFeedback('CSV export downloaded.'); }
    catch (e) { setError(e.message); }
  }
  async function exportData() {
    try { const data = await api('/auth/export'); const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'budgetry-data.json'; a.click(); URL.revokeObjectURL(url); setFeedback('Data export downloaded.'); }
    catch (e) { setError(e.message); }
  }
  async function deleteAccount() {
    try { await api('/auth/account', { method: 'DELETE' }); setUser(null); navigate('/'); }
    catch (e) { setError(e.message); }
  }
  if (!user) return <div className="home-shell">
    <section className="home-hero"><div className="home-copy">
      <span className="eyebrow">A FRESH LOOK AT YOUR FINANCES</span><h1>Make every rupee <span>count.</span></h1>
      <p>Budgetry turns everyday spending into a clearer picture. Track expenses, spot patterns, and make your next money decision with confidence.</p>
      <div className="hero-actions"><Link className="button button-primary" to="/signup">Start tracking free <span aria-hidden="true">↗</span></Link><Link className="button button-secondary" to="/login">Sign in</Link></div>
      <div className="home-proof"><span><i aria-hidden="true">✓</i> Simple expense tracking</span><span><i aria-hidden="true">✓</i> Export when you need it</span><span><i aria-hidden="true">✓</i> No ad trackers</span></div>
    </div>
    <div className="home-visual" aria-label="Interactive sample monthly budget"><div className="orbit orbit-one" aria-hidden="true"></div><div className="orbit orbit-two" aria-hidden="true"></div>
      <article className="panel budget-preview-card"><div className="preview-card-top"><span className="preview-dot" aria-hidden="true"></span><span className="muted">SAMPLE MONTHLY BUDGET</span><span className="preview-spark" aria-hidden="true">✳</span></div>
        <small className="muted">Your monthly limit</small><strong className="preview-budget">₹{demoBudget.toLocaleString('en-IN')}</strong>
        <label className="budget-slider-label" htmlFor="demo-budget">Try adjusting your budget</label><input id="demo-budget" className="budget-slider" type="range" min="10000" max="100000" step="5000" value={demoBudget} onChange={event => setDemoBudget(Number(event.target.value))} />
        <div className="budget-progress-labels"><span>Spent ₹{demoSpend.toLocaleString('en-IN')}</span><span>Left ₹{Math.max(0,demoBudget-demoSpend).toLocaleString('en-IN')}</span></div>
        <div className="budget-track" role="img" aria-label={(Math.round(demoSpend/demoBudget*100)) + ' percent of sample budget spent'}><span style={{width:(Math.min(100,demoSpend/demoBudget*100))+'%'}}></span></div>
        <div className="preview-chart-head"><span className="muted">Weekly spending</span><span className="preview-chip">Sample data</span></div>
        <div className="preview-bars" aria-hidden="true">{[44,68,38,82,57,94,51].map((height,index)=><span key={index} style={{height:height+'%',animationDelay:(index*90)+'ms'}}></span>)}</div>
        <div className="preview-days" aria-hidden="true"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
      </article>
      <div className="floating-note floating-note-top"><span className="floating-icon">↗</span><span><small>Money clarity</small><strong>One step at a time</strong></span></div>
      <div className="floating-note floating-note-bottom"><span className="floating-icon">✓</span><span><small>Your records</small><strong>Stay in your account</strong></span></div>
    </div></section>
    <section className="home-section" id="how-it-works"><div className="home-section-heading"><span className="eyebrow">BUILT FOR EVERYDAY LIFE</span><h2>Less guesswork. <span>More control.</span></h2><p>Everything you need to understand your spending, without turning it into a chore.</p></div>
      <div className="feature-grid home-feature-grid">
        <article className="panel feature-card"><span className="feature-icon">↗</span><span className="feature-number">01 / TRACK</span><h3>Capture the little things</h3><p>Record amounts, dates, categories, and notes in one clear place. Update an entry whenever life changes.</p><div className="feature-link">A simpler daily habit <span>↗</span></div></article>
        <article className="panel feature-card"><span className="feature-icon">▥</span><span className="feature-number">02 / UNDERSTAND</span><h3>See where money goes</h3><p>Use monthly charts, categories, and search to discover patterns that can get lost in a list of transactions.</p><div className="feature-link">Make trends visible <span>↗</span></div></article>
        <article className="panel feature-card"><span className="feature-icon">⌁</span><span className="feature-number">03 / OWN</span><h3>Your data, your choice</h3><p>Export your records to keep a copy, manage your account, and delete your data from the application when you choose.</p><div className="feature-link">Privacy-minded by design <span>↗</span></div></article>
      </div>
    </section>
    <section className="home-cta"><div><span className="eyebrow">YOUR MONEY, YOUR PACE</span><h2>Build a clearer picture of your spending.</h2><p>Start with what you spend today. Your insights grow as you keep going.</p></div><Link className="button button-primary" to="/signup">Create your account <span aria-hidden="true">→</span></Link></section>
    <section className="home-disclaimer"><span aria-hidden="true">✳</span><p>Budgetry is an expense-tracking tool, not financial, investment, tax, or legal advice. The chart above uses sample values so you can try the budget control before signing up.</p></section>
  </div>;
  return <section className="dashboard-wrap">
    <div className="dashboard-heading"><div><span className="eyebrow">YOUR OVERVIEW</span><h1>Hello, {user.name}</h1><p className="muted">A clearer view of your day-to-day spending.</p></div><button className="button button-secondary" onClick={exportCsv}>Export CSV</button></div>
    <div className="stats-grid"><article className="panel stat"><span className="muted">Matching expenses</span><strong>{total}</strong><small>Based on current filters</small></article><article className="panel stat"><span className="muted">Visible page total</span><strong>{money(visibleTotal)}</strong><small>Current page only</small></article><article className="panel stat"><span className="muted">Expense categories</span><strong>{new Set(expenses.map(e => e.category)).size}</strong><small>On this page</small></article></div>
    <div className="dashboard-grid">
      <section className="panel form-panel"><h2 id="expense-form-title" tabIndex="-1">{editing ? 'Edit expense' : 'Add an expense'}</h2><form onSubmit={submit} noValidate>
        <div className="field"><label htmlFor="amount">Amount (INR)</label><input id="amount" aria-describedby={error ? 'expense-form-error' : undefined} type="number" inputMode="decimal" min="0.01" max="100000000" step="0.01" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
        <div className="field"><label htmlFor="category">Category</label><select id="category" aria-describedby={error ? 'expense-form-error' : undefined} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label htmlFor="date">Date</label><input id="date" aria-describedby={error ? 'expense-form-error' : undefined} type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
        <div className="field"><label htmlFor="note">Note <span className="muted">(optional, max 300 characters)</span></label><textarea id="note" aria-describedby={error ? 'expense-form-error' : undefined} rows="3" maxLength="300" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
        {error && <p className="form-error" id="expense-form-error" role="alert">{error}</p>}{feedback && <p className="form-success" role="status">{feedback}</p>}
        <div className="form-actions"><button className="button button-primary" disabled={saving}>{saving ? <><span className="spinner spinner-small" />Saving…</> : editing ? 'Save changes' : 'Add expense'}</button>{editing && <button type="button" className="button button-quiet" onClick={resetForm}>Cancel</button>}</div>
      </form></section>
      <section className="panel chart-panel"><div className="section-heading"><div><h2>Monthly spending</h2><p className="muted">Total expenses by month</p></div><label className="year-select">Year <select value={year} onChange={e => setYear(Number(e.target.value))}>{Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y}>{y}</option>)}</select></label></div>
        <div className="chart" role="img" aria-label={`Monthly spending bar chart for ${year}`}><ResponsiveContainer width="100%" height="100%"><BarChart data={summary} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="month" tick={{ fill: 'var(--muted)', fontSize: 12 }} /><YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} width={58} /><Tooltip formatter={value => money(value)} contentStyle={{ backgroundColor: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border)' }} labelStyle={{ color: 'var(--text)' }} itemStyle={{ color: 'var(--text)' }} /><Bar dataKey="total" name="Spending" fill="var(--accent)" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div><table className="sr-only" aria-label={`Monthly spending data for ${year}`}><caption>Monthly spending for {year}</caption><thead><tr><th scope="col">Month</th><th scope="col">Total (INR)</th></tr></thead><tbody>{summary.map(row => <tr key={row.month}><th scope="row">{row.month}</th><td>{row.total.toFixed(2)}</td></tr>)}</tbody></table>
      </section>
    </div>
    <section className="panel expenses-panel"><div className="section-heading"><div><h2>Expenses</h2><p className="muted">{total} matching records</p></div><button className="button button-quiet" onClick={exportData}>Export all data (JSON)</button></div>
      <div className="filters"><div className="field filter-search"><label htmlFor="expense-search">Search notes</label><div className="search-line"><input id="expense-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses" /><button type="button" className="button button-quiet" onClick={() => setSearch('')} aria-label="Clear expense search">Clear</button></div></div>
        <div className="field"><label htmlFor="filter-category">Category</label><select id="filter-category" value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label htmlFor="filter-from">From</label><input id="filter-from" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div className="field"><label htmlFor="filter-to">To</label><input id="filter-to" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <div className="field"><label htmlFor="filter-sort">Sort by</label><select id="filter-sort" value={sort} onChange={e => setSort(e.target.value)}><option value="date_desc">Newest date</option><option value="date_asc">Oldest date</option><option value="amount_desc">Highest amount</option><option value="amount_asc">Lowest amount</option></select></div>
      </div>
      {siteSearchResults && <div className="site-results"><h3>Site sections matching “{debouncedSearch}”</h3>{siteSearchResults.length ? siteSearchResults.map(s => <Link key={s.path} to={s.path}>{s.label}</Link>) : <p className="muted">No site sections matched. Expense search checks note text only.</p>}</div>}
      {loading ? <div className="skeleton-list" aria-label="Loading expenses">{[1,2,3].map(n => <div className="skeleton-row" key={n}><span /><span /><span /></div>)}</div> : expenses.length ? <div className="table-wrap"><table><thead><tr><th scope="col">Date</th><th scope="col">Expense</th><th scope="col">Category</th><th scope="col">Amount</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{expenses.map(e => <tr key={e._id}><td>{new Date(e.date).toLocaleDateString('en-IN', { timeZone: 'UTC' })}</td><td><strong>{e.note || 'Untitled expense'}</strong></td><td><span className="category-pill">{e.category}</span></td><td className="amount-cell">{money(e.amount)}</td><td><div className="row-actions"><button className="text-button" onClick={() => edit(e)} aria-label={`Edit ${e.note || e.category} expense`}>Edit</button><button className="text-button danger-text" onClick={() => remove(e._id)} aria-label={`Delete ${e.note || e.category} expense`}>Delete</button></div></td></tr>)}</tbody></table></div> : <div className="empty-state"><span className="empty-icon" aria-hidden="true">◎</span><h3>No expenses found</h3><p>Try changing your filters, or add your first expense.</p></div>}
      <div className="pagination"><span className="muted">Page {page} of {pages}</span><div><button className="button button-secondary" disabled={page <= 1 || loading} onClick={() => setPage(p => p-1)}>Previous</button><button className="button button-secondary" disabled={page >= pages || loading} onClick={() => setPage(p => p+1)}>Next</button></div></div>
    </section>
    <section className="panel account-panel"><div><h2>Account and data</h2><p className="muted">Signed in as {user.email}. Export your records or permanently remove your account and expenses.</p></div><button className="button button-danger" onClick={() => setDeleteConfirm(true)}>Delete account</button></section>
    {deleteConfirm && <div className="consent-backdrop"><section className="consent-panel" role="dialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">Delete your account?</h2><p>This permanently deletes your account and all associated expenses. This action cannot be undone.</p><div className="consent-actions"><button className="button button-danger" onClick={deleteAccount}>Delete everything</button><button className="button button-secondary" onClick={() => setDeleteConfirm(false)}>Cancel</button></div></section></div>}
  </section>;
}
