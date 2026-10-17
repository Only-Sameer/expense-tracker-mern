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
    try { const data = await api('/auth/export'); const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'pocketledger-data.json'; a.click(); URL.revokeObjectURL(url); setFeedback('Data export downloaded.'); }
    catch (e) { setError(e.message); }
  }
  async function deleteAccount() {
    try { await api('/auth/account', { method: 'DELETE' }); setUser(null); navigate('/'); }
    catch (e) { setError(e.message); }
  }
  if (!user) return <section className="hero"><span className="eyebrow">POCKETLEDGER</span><h1>Your spending, <span>in perspective.</span></h1><p>A simple place to record expenses, understand monthly trends, and export your data whenever you need it.</p><div className="hero-actions"><a className="button button-primary" href="/signup">Create free account</a><a className="button button-secondary" href="/login">Sign in</a></div><div className="feature-grid"><article className="panel"><h2>Know where it goes</h2><p>Group expenses by category and date.</p></article><article className="panel"><h2>See the bigger picture</h2><p>Review monthly totals with a clear chart.</p></article><article className="panel"><h2>Your data stays yours</h2><p>Export records or delete your account.</p></article></div></section>;
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
