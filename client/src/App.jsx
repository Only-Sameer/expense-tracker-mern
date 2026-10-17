import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api.js';
import Header from './components/Header.jsx';
import { useScrollProgress, useTheme } from './hooks.js';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Legal = lazy(() => import('./pages/Legal.jsx'));
const Auth = lazy(() => import('./pages/Auth.jsx'));
const AdminDashboard = lazy(() => import('./pages/Admin.jsx'));
const Recovery = lazy(() => import('./pages/Recovery.jsx'));

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [serverWaking, setServerWaking] = useState(false);
  const [serverMessage, setServerMessage] = useState('Waking up the server…');
  const [startupError, setStartupError] = useState('');
  const [cookieChoice, setCookieChoice] = useState(() => {
    try { return JSON.parse(localStorage.getItem('expense-cookie-consent') || 'null'); } catch { return null; }
  });
  const [cookieSettings, setCookieSettings] = useState(false);
  const [showBackTop, setShowBackTop] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const progress = useScrollProgress();

  useEffect(() => {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = 'https://only-sameer-expense-tracker-web.onrender.com' + path;
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) {
      const privateRoute = /^\/(admin|login|signup|forgot-password|reset-password|verification-request|verify-email)(?:\/|$)/.test(path);
      robots.content = privateRoute ? 'noindex,nofollow' : 'index,follow,max-image-preview:large';
    }
  }, [location.pathname]);

  useEffect(() => {
    const onServerState = event => { setServerWaking(Boolean(event.detail?.active)); if (event.detail?.message) setServerMessage(event.detail.message); };
    window.addEventListener('budgetry:server-state', onServerState);
    return () => window.removeEventListener('budgetry:server-state', onServerState);
  }, []);
  useEffect(() => {
    api('/auth/me').then(data => { setUser(data.user); setStartupError(''); }).catch(error => { setUser(null); if (error.status !== 401) setStartupError(error.message || 'Could not connect to the server.'); }).finally(() => setAuthChecked(true));
  }, []);
  useEffect(() => {
    let frame = 0;
    const onScroll = () => { if (frame) return; frame = requestAnimationFrame(() => { frame = 0; setShowBackTop(window.scrollY > 300); }); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame); };
  }, []);
  const saveConsent = choice => {
    const record = { choice, timestamp: new Date().toISOString(), policyVersion: '2026-10-17' };
    try { localStorage.setItem('expense-cookie-consent', JSON.stringify(record)); } catch { /* App still works without storage. */ }
    setCookieChoice(record); setCookieSettings(false);
  };
  async function logout() { try { await api('/auth/logout', { method: 'POST' }); } finally { setUser(null); navigate('/'); } }
  return <>
    <div className="scroll-progress" aria-hidden="true" style={{ transform: `scaleX(${progress / 100})` }} />
    <Header user={user} theme={theme} onThemeToggle={toggleTheme} onLogout={logout} />
    {(authChecked && (serverWaking || startupError)) && <div className="server-waking-banner" role="status" aria-live="polite">
      <span className={serverWaking ? 'spinner spinner-small' : 'server-status-dot'} aria-hidden="true" />
      <span>{startupError && !serverWaking ? startupError : serverMessage}</span>
      <button type="button" className="text-action" onClick={async () => { setStartupError(''); try { const data = await api('/auth/me'); setUser(data.user); } catch (error) { setUser(null); if (error.status !== 401) setStartupError(error.message || 'Could not connect to the server.'); } }}>Try again</button>
    </div>}
    <main id="main" tabIndex="-1">
      <Suspense fallback={<div className="page-loader" role="status"><span className="spinner" />Loading page…</div>}>
        <Routes>
          <Route path="/" element={authChecked ? <Dashboard key={user?.id || 'anonymous'} user={user} setUser={setUser} onThemeToggle={toggleTheme} theme={theme} /> : <div className="server-waking-state" role="status" aria-live="polite"><span className="spinner" /><h1>{serverWaking ? 'Waking up the server…' : 'Connecting to Budgetry…'}</h1><p>{serverWaking ? 'The service may be starting after a quiet period. We are retrying safely. Please hang tight.' : 'Checking your session and preparing your dashboard.'}</p><div className="waking-progress" aria-hidden="true"><span /></div></div>} />
          <Route path="/admin" element={!authChecked ? <div className="page-loader" role="status"><span className="spinner" />Checking session…</div> : user?.isAdmin ? <AdminDashboard /> : <Navigate to={user ? '/' : '/login?next=%2Fadmin&admin=1'} replace />} />
          <Route path="/login" element={<Auth mode="login" setUser={setUser} />} />
          <Route path="/signup" element={<Auth mode="signup" setUser={setUser} />} />
          <Route path="/forgot-password" element={<Recovery mode="forgot" />} />
          <Route path="/reset-password" element={<Recovery mode="reset" />} />
          <Route path="/verification-request" element={<Recovery mode="verification-request" />} />
          <Route path="/verify-email" element={<Recovery mode="verify" setUser={setUser} />} />
          <Route path="/privacy" element={<Legal page="privacy" />} />
          <Route path="/terms" element={<Legal page="terms" />} />
          <Route path="/cookies" element={<Legal page="cookies" />} />
          <Route path="*" element={<section className="empty-state"><h1>Page not found</h1><p>That page does not exist.</p><Link className="button button-primary" to="/">Go home</Link></section>} />
        </Routes>
      </Suspense>
    </main>
    <footer className="site-footer"><span>© {new Date().getFullYear()} Budgetry</span><div><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/cookies">Cookie Policy</Link><button className="text-button" onClick={() => setCookieSettings(true)}>Cookie settings</button></div><small>No advertising or behavioural analytics are included. Optional bot protection, Google sign-in and error reporting activate only when configured; see Privacy.</small></footer>
    {(!cookieChoice || cookieSettings) && <div className="consent-backdrop">
      <section className="consent-panel" role="dialog" aria-modal="true" aria-labelledby="consent-title">
        <h2 id="consent-title">{cookieSettings ? 'Cookie preferences' : 'Your privacy choices'}</h2>
        <p>We use essential session and preference storage. If enabled by the site operator, Cloudflare Turnstile protects forms, Google Identity Services provides sign-in, and Sentry receives technical error diagnostics. We do not use advertising or behavioural analytics. Read our <Link to="/cookies">Cookie Policy</Link>.</p>
        <p className="muted">Essential storage is always active. Optional integrations are enabled only when their environment keys are configured and are disclosed in the Privacy Policy.</p>
        <div className="consent-actions"><button className="button button-secondary" onClick={() => saveConsent('accepted')}>Accept all</button><button className="button button-secondary" onClick={() => saveConsent('rejected')}>Reject non-essential</button><button className="button button-secondary" onClick={() => setCookieSettings(true)}>Manage preferences</button></div>
        {cookieSettings && <div className="consent-manage"><p><strong>Optional integrations:</strong> Budgetry does not use advertising or behavioural analytics. When configured, Cloudflare Turnstile may process anti-bot signals, Google Identity Services handles Google sign-in, and Sentry receives technical error diagnostics. These services are disclosed in our policies.</p><button className="button button-primary" onClick={() => saveConsent('managed')}>Save preferences</button><button className="text-button" onClick={() => setCookieSettings(false)}>Close without changing</button></div>}
      </section>
    </div>}
    {showBackTop && <button className="back-top" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>↑</button>}
  </>;
}
