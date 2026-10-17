import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });
const monthName = value => {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit' }).format(new Date(year, month - 1, 1));
};

function Metric({ label, value, hint }) {
  return <article className="panel admin-metric"><span>{label}</span><strong>{value}</strong><small>{hint}</small></article>;
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  const [usersResult, setUsersResult] = useState(null);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setOverviewLoading(true);
    api('/admin/overview')
      .then(result => { if (active) { setOverview(result); setOverviewError(''); } })
      .catch(error => { if (active) setOverviewError(error.message || 'Could not load admin overview.'); })
      .finally(() => { if (active) setOverviewLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  useEffect(() => {
    let active = true;
    setUsersLoading(true);
    const query = new URLSearchParams({ page: String(page), limit: '10', search });
    api(`/admin/users?${query.toString()}`)
      .then(result => { if (active) { setUsersResult(result); setUsersError(''); } })
      .catch(error => { if (active) setUsersError(error.message || 'Could not load users.'); })
      .finally(() => { if (active) setUsersLoading(false); });
    return () => { active = false; };
  }, [page, search, refreshKey]);

  const maxMonthly = useMemo(() => Math.max(1, ...(overview?.monthly || []).map(item => item.amount)), [overview]);

  return <section className="dashboard-wrap admin-wrap">
    <div className="dashboard-heading admin-heading">
      <div>
        <span className="eyebrow">BUDGETRY / ADMIN</span>
        <h1>Admin overview</h1>
        <p className="muted">Manage visibility into account activity and platform health.</p>
      </div>
      <div className="admin-header-actions">
        <button className="button button-secondary" onClick={() => setRefreshKey(value => value + 1)} disabled={overviewLoading || usersLoading}>
          {overviewLoading || usersLoading ? <><span className="spinner spinner-small" aria-hidden="true" /> Refreshing…</> : 'Refresh data'}
        </button>
        <Link className="button button-quiet" to="/">User dashboard</Link>
      </div>
    </div>

    {overviewError && <div className="panel admin-error" role="alert"><strong>Overview unavailable</strong><p>{overviewError}</p><p className="muted">Check that your email is included in the server-side ADMIN_EMAILS environment variable, then sign out and sign in again.</p></div>}
    {usersError && <div className="panel admin-error" role="alert"><strong>User directory unavailable</strong><p>{usersError}</p></div>}

    {overviewLoading && !overview ? <div className="page-loader" role="status"><span className="spinner" />Loading admin overview…</div> : overview && <>
      <div className="stats-grid admin-stats">
        <Metric label="Registered users" value={overview.summary.totalUsers.toLocaleString('en-IN')} hint="All accounts" />
        <Metric label="New accounts" value={overview.summary.newUsers30Days.toLocaleString('en-IN')} hint="Last 30 days" />
        <Metric label="Expenses recorded" value={overview.summary.totalExpenses.toLocaleString('en-IN')} hint="Across all accounts" />
        <Metric label="Total recorded" value={money.format(overview.summary.totalAmount)} hint="Aggregated amount; no notes shown" />
      </div>

      <div className="admin-panels-grid">
        <section className="panel admin-panel">
          <div className="section-heading"><div><h2>Monthly activity</h2><p className="muted">Expense totals over the last six months</p></div></div>
          {overview.monthly.length === 0 ? <p className="empty-state">No expense activity yet.</p> : <div className="admin-monthly-list">
            {overview.monthly.map(item => <div className="admin-month-row" key={item.month}>
              <span>{monthName(item.month)}</span>
              <div className="admin-bar-track" aria-label={`${money.format(item.amount)} recorded`}><span style={{ width: `${Math.max(3, (item.amount / maxMonthly) * 100)}%` }} /></div>
              <strong>{money.format(item.amount)}</strong>
            </div>)}
          </div>}
        </section>
        <section className="panel admin-panel">
          <div className="section-heading"><div><h2>Categories</h2><p className="muted">Aggregated totals by expense category</p></div></div>
          {overview.categories.length === 0 ? <p className="empty-state">No categories to report yet.</p> : <div className="table-wrap"><table className="admin-table"><thead><tr><th>Category</th><th>Count</th><th>Total</th></tr></thead><tbody>
            {overview.categories.map(item => <tr key={item.category}><td>{item.category}</td><td>{item.count.toLocaleString('en-IN')}</td><td className="amount-cell">{money.format(item.amount)}</td></tr>)}
          </tbody></table></div>}
        </section>
      </div>

      <section className="panel admin-panel admin-recent-users">
        <div className="section-heading"><div><h2>Recently registered</h2><p className="muted">Latest eight accounts. Expense notes and personal transaction details are not shown here.</p></div></div>
        {overview.recentUsers.length === 0 ? <p className="empty-state">No accounts registered yet.</p> : <div className="table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Joined</th></tr></thead><tbody>
          {overview.recentUsers.map(user => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.createdAt ? date.format(new Date(user.createdAt)) : '—'}</td></tr>)}
        </tbody></table></div>}
      </section>

      <section className="panel admin-panel admin-user-directory">
        <div className="section-heading"><div><h2>User directory</h2><p className="muted">Search accounts and see basic usage counts.</p></div><div className="admin-directory-meta">{usersResult ? `${usersResult.pagination.total.toLocaleString('en-IN')} accounts` : ''}</div></div>
        <form className="admin-search" onSubmit={event => { event.preventDefault(); setPage(1); }} role="search">
          <label className="sr-only" htmlFor="admin-user-search">Search users by name or email</label>
          <input id="admin-user-search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search by name or email" maxLength={80} />
          {search && <button type="button" className="button button-quiet" onClick={() => { setSearch(''); setPage(1); }}>Clear</button>}
        </form>
        {usersLoading && !usersResult ? <div className="page-loader" role="status"><span className="spinner" />Loading users…</div> : usersResult && <>
          <div className="table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Expenses</th><th>Joined</th></tr></thead><tbody>
            {usersResult.users.map(user => <tr key={user.id}><td>{user.name}</td><td>{user.email}</td><td>{user.expenseCount.toLocaleString('en-IN')}</td><td>{user.createdAt ? date.format(new Date(user.createdAt)) : '—'}</td></tr>)}
            {usersResult.users.length === 0 && <tr><td colSpan="4" className="empty-state">No matching accounts found.</td></tr>}
          </tbody></table></div>
          <div className="pagination"><span className="muted">Page {usersResult.pagination.page} of {usersResult.pagination.pages}</span><div><button className="button button-secondary" disabled={page <= 1 || usersLoading} onClick={() => setPage(value => Math.max(1, value - 1))}>Previous</button><button className="button button-secondary" disabled={page >= usersResult.pagination.pages || usersLoading} onClick={() => setPage(value => value + 1)}>Next</button></div></div>
        </>}
      </section>
      <p className="admin-footnote">Access to this page is controlled by the backend email allowlist. Only high-level aggregates, account directory fields, and usage counts are displayed.</p>
    </>}
  </section>;
}
