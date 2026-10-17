import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, META, money, today, dayKey, displayCategory, formatDate, budgetTone, itemId } from '../lib/finance.js';
import { api } from '../api.js';


function EmptyIllustration({ compact = false }) {
  return <div className={'empty-illustration' + (compact ? ' compact' : '')} aria-hidden="true"><svg viewBox="0 0 180 124">
    <rect x="25" y="17" width="130" height="92" rx="14" fill="currentColor" opacity=".06" />
    <path d="M46 85V55M68 85V42M90 85V63M112 85V31M134 85V49" stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity=".22" />
    <path d="M40 93H142" stroke="currentColor" strokeWidth="2" opacity=".35" /><circle cx="136" cy="28" r="13" fill="#10B981" opacity=".18" />
    <path d="m130 28 4 4 8-9" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg></div>;
}
export function EmptyState({ title, description, onAdd, compact = false }) {
  return <div className={compact ? 'chart-empty' : 'list-empty'}>
    <EmptyIllustration compact={compact} />
    {compact ? <p>{title}</p> : <h3>{title}</h3>}
    {description && <p className="empty-description">{description}</p>}
    {onAdd && <button type="button" className="button button-primary" onClick={onAdd}>Add your first expense</button>}
  </div>;
}

export function Sidebar({ active, onChange, demo, onExit }) {
  const links = [['dashboard','▦','Dashboard'],['expenses','≡','Expenses'],['reports','▥','Reports'],['budgets','◴','Budgets'],['settings','⚙','Settings']];
  return <aside className="budgetry-sidebar" aria-label="Primary navigation">
    <p className="sidebar-label">WORKSPACE</p><nav className="sidebar-nav">
      {links.map(([id, icon, label]) => <button key={id} type="button" className={'sidebar-link' + (active === id ? ' is-active' : '')} onClick={() => onChange(id)} aria-current={active === id ? 'page' : undefined}><span aria-hidden="true" className="nav-icon">{icon}</span><span>{label}</span></button>)}
    </nav>
    <div className="sidebar-bottom"><div className="sidebar-prompt"><span>✳</span><strong>Spend with intention</strong><p>Small habits build financial clarity.</p></div>
      {demo && <button className="sidebar-link" type="button" onClick={onExit}><span className="nav-icon">↩</span>Exit demo</button>}
      <div className="sidebar-brand-note"><span className="avatar">B</span><span><strong>Budgetry</strong><small>Know where your money goes.</small></span></div>
    </div>
  </aside>;
}
export function StatCard({ label, value, caption, icon, tone = 'green', trend }) {
  return <article className="stat-card"><div className="stat-card-top"><span className={'stat-icon tone-' + tone} aria-hidden="true">{icon}</span><span className="stat-label">{label}</span></div>
    <strong className="stat-value">{value}</strong><div className="stat-caption">{trend && <span className={'trend ' + (trend.good ? 'trend-good' : 'trend-bad')}>{trend.good ? '↘' : '↗'} {trend.text}</span>}{caption}</div>
  </article>;
}
export function ExpenseForm({ initialValue, prefill, onClose, onSubmit, submitting, error, clearError, categories = CATEGORIES }) {
  const source = initialValue || prefill || null;
  const [form, setForm] = useState(() => source
    ? { amount: String(source.amount ?? ''), category: displayCategory(source.category), date: dayKey(source) || source.date || today(), note: source.note || '', tags: source.tags || [] }
    : { amount: '', category: 'Food', date: today(), note: '', tags: [] });
  const amountRef = useRef(null);
  const [tried, setTried] = useState(false);
  useEffect(() => { amountRef.current?.focus(); }, []);
  function change(key, value) { setForm(old => ({ ...old, [key]: value })); if (error) clearError(); }
  const amountOk = form.amount !== '' && Number.isFinite(Number(form.amount)) && Number(form.amount) > 0;
  const dt = new Date(form.date + 'T12:00:00');
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(form.date) && !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === form.date;
  async function submit(event) {
    event.preventDefault();
    setTried(true);
    if (!amountOk || !dateOk) return;
    await onSubmit({ ...form, amount: Number(form.amount), tags: (form.tags || []).map(tag => String(tag).trim()).filter(Boolean).slice(0, 8) });
  }
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-modal-title">
      <div className="modal-head"><div><p className="section-kicker">{initialValue ? 'UPDATE RECORD' : 'NEW RECORD'}</p><h2 id="expense-modal-title">{initialValue ? 'Edit expense' : 'Add an expense'}</h2><p className="muted">A few details, and you’re done.</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close form">×</button></div>
      <form onSubmit={submit} noValidate>
        <div className="amount-field"><label htmlFor="expense-amount">Amount <span>(INR ₹)</span></label><div className="amount-input-wrap"><span aria-hidden="true">₹</span><input ref={amountRef} id="expense-amount" type="number" inputMode="decimal" min="0.01" max="100000000" step="0.01" placeholder="0.00" value={form.amount} onChange={e => change('amount', e.target.value)} aria-invalid={tried && !amountOk} aria-describedby={tried && !amountOk ? 'amount-error' : undefined} /></div>{tried && !amountOk && <small className="field-error" id="amount-error">Enter an amount greater than ₹0.</small>}</div>
        <fieldset className="category-field"><legend>Category</legend><div className="category-chips">{categories.map(category => <button type="button" key={category} className={'category-chip' + (form.category === category ? ' selected' : '')} onClick={() => change('category', category)} aria-pressed={form.category === category}><span aria-hidden="true">{META[category]?.icon || '•'}</span>{category}</button>)}</div></fieldset>
        <div className="form-two-col"><div className="field"><label htmlFor="expense-date">Date</label><input id="expense-date" type="date" value={form.date} onChange={e => change('date', e.target.value)} aria-invalid={tried && !dateOk} required />{tried && !dateOk && <small className="field-error">Choose a valid date.</small>}</div><div className="field"><label htmlFor="expense-note">Note <span className="muted">(optional)</span></label><textarea id="expense-note" rows="2" maxLength="300" placeholder="e.g. Groceries for the week" value={form.note} onChange={e => change('note', e.target.value)} /><small className="character-count">{form.note.length}/300</small></div></div>
        <div className="field tags-field"><label htmlFor="expense-tags">Tags <span className="muted">(optional, up to 8)</span></label><input id="expense-tags" value={(form.tags || []).join(', ')} maxLength={240} placeholder="e.g. work, reimbursable" onChange={e => change('tags', e.target.value.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 8))} /><small className="muted">{(form.tags || []).length}/8 tags · Separate tags with commas.</small></div>
        {error && <p className="inline-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={submitting}>{submitting ? 'Saving…' : initialValue ? 'Save changes' : 'Add expense'}</button></div>
      </form>
    </section>
  </div>;
}

export function ExpenseTable({ items, onEdit, onDelete, onAdd, onTouchStart, onTouchEnd, swipedId }) {
  if (!items.length) return <EmptyState title="No expenses found" description="Try changing your filters, or add your first expense." onAdd={onAdd} />;
  return <><div className="expense-table-wrap"><table className="expense-table"><thead><tr><th scope="col">Expense</th><th scope="col">Category</th><th scope="col">Date</th><th scope="col" className="numeric">Amount</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>
    {items.map(item => {
      const cat=displayCategory(item.category); const meta=META[cat]||META.Other;
      return <tr key={itemId(item)}>
        <td><div className="expense-title"><span className="expense-leading" style={{background:meta.color+'20',color:meta.color}}>{meta.icon}</span><span><strong>{item.note||cat+' expense'}</strong><small>{item.note?cat+' expense':'Added to Budgetry'}</small>{item.tags?.length>0&&<span className="expense-tags">{item.tags.slice(0,4).map(tag=><span key={tag}>{tag}</span>)}</span>}</span></div></td>
        <td><span className="category-badge" style={{'--category-color':meta.color}}>{cat}</span></td>
        <td>{formatDate(item.date)}</td><td className="numeric amount-cell">{money(item.amount)}</td>
        <td><div className="row-actions"><button type="button" className="text-action" onClick={()=>onEdit(item)} aria-label={'Edit '+(item.note||cat)+' expense'}>Edit</button><button type="button" className="text-action danger-action" onClick={()=>onDelete(item)} aria-label={'Delete '+(item.note||cat)+' expense'}>Delete</button></div></td>
      </tr>;
    })}
  </tbody></table></div><div className="expense-mobile-list">
    {items.map(item=>{const cat=displayCategory(item.category);const meta=META[cat]||META.Other;return <article key={itemId(item)} className={'expense-mobile-card'+(swipedId===itemId(item)?' swiped':'')} onTouchStart={e=>onTouchStart(e,itemId(item))} onTouchEnd={e=>onTouchEnd(e,itemId(item))}>
      <div className="mobile-expense-main"><span className="expense-leading" style={{background:meta.color+'20',color:meta.color}}>{meta.icon}</span><div className="mobile-expense-copy"><strong>{item.note||cat+' expense'}</strong><span className="muted">{cat} · {formatDate(item.date)}</span>{item.tags?.length>0&&<span className="expense-tags">{item.tags.slice(0,4).map(tag=><span key={tag}>{tag}</span>)}</span>}</div><strong className="mobile-expense-amount">{money(item.amount)}</strong></div>
      <div className="mobile-row-actions"><button type="button" className="text-action" onClick={()=>onEdit(item)}>Edit</button><button type="button" className="text-action danger-action" onClick={()=>onDelete(item)}>Delete</button></div>
    </article>;})}
  </div></>;
}
export function BudgetCard({ category, amount, budget, onChange }) {
  const ratio=budget>0?amount/budget:0;const tone=budgetTone(amount,budget);const meta=META[category]||META.Other;
  return <article className="budget-category-card"><div className="budget-category-head"><span className="expense-leading" style={{background:meta.color+'20',color:meta.color}}>{meta.icon}</span><div className="budget-category-name"><strong>{category}</strong><span className="muted">{money(amount)} spent</span></div><div className="budget-limit-field"><label htmlFor={'budget-'+category} className="sr-only">Monthly budget for {category}</label><span>₹</span><input id={'budget-'+category} type="number" min="0" step="500" value={budget||''} placeholder="Set limit" onChange={e=>onChange(category,Math.max(0,Number(e.target.value)||0))}/></div></div><div className="budget-track budget-track-large"><span className={'budget-fill '+tone} style={{width:Math.min(100,ratio*100)+'%'}}/></div><div className="budget-foot"><span className={'budget-status '+tone}>{budget<=0?'Set a limit':ratio>=1?'Over budget':ratio>=.8?'Near limit':'On track'}</span><span>{budget>0?Math.round(ratio*100)+'% of '+money(budget):'No budget set'}</span></div></article>;
}
export function SettingsPage({ user, demo, onDelete, onImport, onCsv, onJson, onAllData, onThemeToggle, theme, onSignedOut, onUserUpdate }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteTotpCode, setDeleteTotpCode] = useState('');
  const [sessions, setSessions] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');
  const [reauthPassword, setReauthPassword] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const fileRef = useRef(null);

  async function loadSecurity() {
    if (demo) return;
    setSecurityLoading(true);
    setSecurityError('');
    try {
      const [sessionResult, auditResult] = await Promise.all([
        api('/auth/sessions'),
        api('/auth/audit').catch(() => ({ events: [] })),
      ]);
      setSessions(sessionResult.sessions || []);
      setAuditEvents(auditResult.events || []);
    } catch (error) {
      setSecurityError(error.message || 'Could not load security information.');
    } finally { setSecurityLoading(false); }
  }
  useEffect(() => { void loadSecurity(); }, [demo]);

  async function revokeSession(session) {
    setSecurityError(''); setSecurityMessage('');
    try {
      await api('/auth/sessions/' + session.id, { method: 'DELETE' });
      if (session.current) { onSignedOut?.(); return; }
      setSessions(items => items.filter(item => item.id !== session.id));
      setSecurityMessage('Session revoked.');
    } catch (error) { setSecurityError(error.message || 'Could not revoke session.'); }
  }
  async function logoutAllSessions() {
    setSecurityError(''); setSecurityMessage('');
    try {
      await api('/auth/logout-all', { method: 'POST' });
      onSignedOut?.();
    } catch (error) { setSecurityError(error.message || 'Could not sign out other sessions.'); }
  }
  async function setupAuthenticator() {
    setSecurityError(''); setSecurityMessage('');
    try {
      await api('/auth/reauth', { method: 'POST', body: JSON.stringify({ password: reauthPassword }) });
      const result = await api('/auth/2fa/setup', { method: 'POST', body: JSON.stringify({}) });
      setTotpSecret(result.secret);
      setTotpCode('');
      setSecurityMessage('Add this secret to your authenticator app, then enter its six-digit code to enable 2FA.');
    } catch (error) { setSecurityError(error.message || 'Could not start authenticator setup.'); }
  }
  async function enableAuthenticator() {
    setSecurityError(''); setSecurityMessage('');
    try {
      const result = await api('/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ code: totpCode }) });
      onUserUpdate?.(result.user);
      setTotpSecret(''); setTotpCode('');
      setSecurityMessage('Two-factor authentication is enabled.');
    } catch (error) { setSecurityError(error.message || 'Could not enable two-factor authentication.'); }
  }
  async function disableAuthenticator() {
    setSecurityError(''); setSecurityMessage('');
    try {
      const result = await api('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ password: disablePassword, code: disableCode }) });
      onUserUpdate?.(result.user);
      setDisablePassword(''); setDisableCode('');
      setSecurityMessage('Two-factor authentication is disabled.');
    } catch (error) { setSecurityError(error.message || 'Could not disable two-factor authentication.'); }
  }

  return <div className="view-stack">
    <div className="page-title-block"><p className="section-kicker">PREFERENCES</p><h1>Settings</h1><p className="muted">Manage your appearance, sessions, and personal data.</p></div>
    <section className="surface-card settings-section"><div><p className="section-kicker">APPEARANCE</p><h2>Theme</h2><p className="muted">Follows your system setting by default. You can switch any time.</p></div><div className="theme-control"><span>{theme === 'dark' ? '🌙 Dark mode' : '☀ Light mode'}</span><button type="button" className={'switch-control' + (theme === 'dark' ? ' on' : '')} onClick={onThemeToggle} role="switch" aria-checked={theme === 'dark'} aria-label="Toggle theme"><span /></button></div></section>

    <section className="surface-card security-section">
      <div className="card-heading"><div><p className="section-kicker">SECURITY</p><h2>Active sessions</h2><p className="muted">See the browsers currently signed in to your account and revoke any you don’t recognize.</p></div><button type="button" className="button button-secondary" onClick={loadSecurity} disabled={securityLoading}>{securityLoading ? 'Refreshing…' : 'Refresh sessions'}</button></div>
      {demo ? <p className="muted">Session controls are unavailable in local demo mode.</p> : securityLoading && !sessions.length ? <p className="muted" role="status">Loading sessions…</p> : sessions.length ? <div className="security-session-list">{sessions.map(session => <article className="security-session-row" key={session.id}><span className="session-device-icon" aria-hidden="true">{session.current ? '●' : '○'}</span><div className="session-details"><strong>{session.userAgent}{session.current ? ' · This device' : ''}</strong><span className="muted">Last active {new Date(session.lastUsedAt || session.createdAt).toLocaleString('en-IN')} · Expires {new Date(session.expiresAt).toLocaleDateString('en-IN')}</span><span className="muted">{session.keepSignedIn ? 'Keep me signed in enabled' : 'Short session'}</span></div><button type="button" className="text-action danger-action" onClick={() => revokeSession(session)} aria-label={'Revoke session for ' + session.userAgent}>Log out</button></article>)}</div> : <p className="muted">No active sessions were returned.</p>}
      {!demo && <div className="settings-actions"><button type="button" className="button button-secondary" onClick={logoutAllSessions}>Log out of all devices</button></div>}
    </section>

    <section className="surface-card security-section">
      <div><p className="section-kicker">TWO-FACTOR AUTHENTICATION</p><h2>Authenticator app</h2><p className="muted">Add a time-based one-time password (TOTP) code as a second sign-in factor.</p></div>
      {demo ? <p className="muted">2FA settings are unavailable in demo mode.</p> : user?.twoFactorEnabled ? <div className="security-form">
        <p className="form-success" role="status">Authenticator sign-in is enabled.</p>
        <div className="field"><label htmlFor="disable-2fa-password">Password</label><input id="disable-2fa-password" type="password" autoComplete="current-password" value={disablePassword} onChange={e => setDisablePassword(e.target.value)} /></div>
        <div className="field"><label htmlFor="disable-2fa-code">Authenticator code</label><input id="disable-2fa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={disableCode} onChange={e => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /></div>
        <button type="button" className="button button-danger" onClick={disableAuthenticator} disabled={disablePassword.length === 0 || disableCode.length !== 6}>Disable 2FA</button>
      </div> : user?.googleConnected ? <p className="muted">For Google-linked accounts, configure a local password first before enabling an authenticator factor.</p> : <div className="security-form">
        <div className="field"><label htmlFor="reauth-password-2fa">Confirm your password</label><input id="reauth-password-2fa" type="password" autoComplete="current-password" value={reauthPassword} onChange={e => setReauthPassword(e.target.value)} /></div>
        {!totpSecret ? <button type="button" className="button button-primary" onClick={setupAuthenticator} disabled={!reauthPassword}>Set up authenticator</button> : <><p className="muted">Enter this secret manually into your authenticator app:</p><code className="totp-secret">{totpSecret}</code><div className="field"><label htmlFor="enable-2fa-code">Six-digit authenticator code</label><input id="enable-2fa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /></div><button type="button" className="button button-primary" onClick={enableAuthenticator} disabled={totpCode.length !== 6}>Enable 2FA</button></>}
      </div>}
    </section>

    {securityError && <p className="inline-error" role="alert">{securityError}</p>}
    {securityMessage && <p className="form-success" role="status">{securityMessage}</p>}
    <section className="surface-card settings-section"><div><p className="section-kicker">YOUR DATA</p><h2>Import and export</h2><p className="muted">Keep a backup or bring expense records from a spreadsheet. CSV needs Date, Amount and Category columns; Note and Tags are optional.</p></div><div className="settings-actions"><button className="button button-secondary" type="button" onClick={onCsv}>↓ Export CSV</button><button className="button button-secondary" type="button" onClick={onJson}>↓ Export JSON</button><button className="button button-secondary" type="button" onClick={onAllData}>↓ Download all my data</button><button className="button button-secondary" type="button" onClick={() => fileRef.current?.click()}>↑ Import CSV</button><input ref={fileRef} type="file" accept=".csv,text/csv" hidden aria-label="Choose CSV file to import" onChange={e => { const file=e.target.files?.[0]; if(file)onImport(file); e.target.value=''; }} /></div></section>

    <section className="surface-card account-settings"><span className="avatar settings-avatar">{(user?.name || 'B').slice(0,1).toUpperCase()}</span><div className="settings-account-copy"><p className="section-kicker">ACCOUNT</p><h2>{user?.name || 'Demo profile'}</h2><p className="muted">{demo ? 'Demo data is local to this session.' : user?.email}</p>{!demo && <p className="muted">{user?.emailVerified ? 'Email verified' : 'Email verification pending'}</p>}</div></section>

    <section className="surface-card audit-section"><div className="card-heading"><div><p className="section-kicker">ACCOUNT ACTIVITY</p><h2>Recent security events</h2><p className="muted">A short history of sign-ins and security changes.</p></div></div>{demo ? <p className="muted">Activity history is unavailable in demo mode.</p> : auditEvents.length ? auditEvents.slice(0,8).map(event => <div className="audit-row" key={event._id || event.createdAt + event.action}><span>{event.success ? '✓' : '!'}</span><strong>{String(event.action || 'activity').replace(/-/g,' ')}</strong><time>{new Date(event.createdAt).toLocaleString('en-IN')}</time></div>) : <p className="muted">No recent security events available.</p>}</section>

    <section className="surface-card danger-zone"><div><p className="section-kicker danger-kicker">DANGER ZONE</p><h2>Delete account</h2><p className="muted">Permanently remove your account and saved expenses. Type DELETE and confirm your password to continue.</p></div><button type="button" className="button button-danger" onClick={() => { setTyped(''); setDeletePassword(''); setDeleteTotpCode(''); setConfirming(true); }}>Delete account</button></section>
    {confirming && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setConfirming(false); }}><section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><span className="danger-icon" aria-hidden="true">!</span><h2 id="delete-title">{demo ? 'End demo session?' : 'Delete your account?'}</h2><p>{demo ? 'Exit demo mode and remove the sample workspace from this view.' : 'This permanently removes your account and all associated expenses. There is no undo for account deletion.'}</p><p>Type <strong>DELETE</strong> below to confirm.</p><label htmlFor="confirm-delete">Confirmation</label><input id="confirm-delete" autoFocus value={typed} onChange={e => setTyped(e.target.value)} placeholder="Type DELETE" autoComplete="off" />
      {!demo && !user?.googleConnected && <div className="field delete-confirm-password"><label htmlFor="delete-password">Current password</label><input id="delete-password" type="password" autoComplete="current-password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} /></div>}
      {!demo && user?.twoFactorEnabled && <div className="field delete-confirm-password"><label htmlFor="delete-totp-code">Authenticator code</label><input id="delete-totp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={deleteTotpCode} onChange={e => setDeleteTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /><small className="muted">Required because two-factor authentication is enabled.</small></div>}
      {!demo && user?.googleConnected && !user?.twoFactorEnabled && <p className="muted">For a Google-linked account, sign in again and return to this dialog within five minutes before confirming deletion.</p>}
      <div className="modal-actions"><button className="button button-quiet" onClick={() => setConfirming(false)}>Cancel</button><button className="button button-danger" disabled={typed !== 'DELETE' || (!demo && !user?.googleConnected && !deletePassword) || (!demo && user?.twoFactorEnabled && deleteTotpCode.length !== 6)} onClick={async () => { setConfirming(false); await onDelete({ password: deletePassword, ...(deleteTotpCode ? { totpCode: deleteTotpCode } : {}) }); }}>Delete permanently</button></div></section></div>}
  </div>;
}
