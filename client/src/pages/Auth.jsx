import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../api.js';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80, 'Name must be 80 characters or fewer.').optional(),
  email: z.string().trim().max(254).pipe(z.email({ error: 'Enter a valid email address.' })),
  password: z.string().min(10, 'Use at least 10 characters.').max(128).refine(value => new TextEncoder().encode(value).length <= 72, 'Password must be no more than 72 UTF-8 bytes.'),
});

function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve();
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = id; script.src = src; script.async = true; script.defer = true;
    script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function Auth({ mode, setUser }) {
  const signup = mode === 'signup';
  const [form, setForm] = useState({ name: '', email: '', password: '', keepSignedIn: true, totpCode: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [captchaRequired, setCaptchaRequired] = useState(signup);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaLoadError, setCaptchaLoadError] = useState('');
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [googleCredential, setGoogleCredential] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const amountRef = useRef(null);
  const turnstileRef = useRef(null);
  const googleButtonRef = useRef(null);
  const turnstileWidgetId = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const adminLogin = params.get('admin') === '1' && !signup;
  const rawNext = params.get('next');
  const nextPath = rawNext?.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes('\\\\') ? rawNext : '/';
  const showCaptcha = Boolean(TURNSTILE_SITE_KEY && (signup || captchaRequired));

  useEffect(() => {
    if (!showCaptcha) return undefined;
    let cancelled = false;
    loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', 'budgetry-turnstile-script')
      .then(() => {
        if (cancelled || !turnstileRef.current || !window.turnstile) return;
        if (turnstileWidgetId.current !== null) {
          try { window.turnstile.remove(turnstileWidgetId.current); } catch { /* Widget may already be removed. */ }
          turnstileWidgetId.current = null;
        }
        turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
          callback: token => { setCaptchaToken(token); setCaptchaLoadError(''); },
          'expired-callback': () => setCaptchaToken(''),
          'error-callback': () => { setCaptchaToken(''); setCaptchaLoadError('Security check could not load. Refresh the challenge or try again later.'); },
        });
      })
      .catch(() => { if (!cancelled) setCaptchaLoadError('Security check could not load. Check your connection and try again.'); });
    return () => {
      cancelled = true;
      if (turnstileWidgetId.current !== null && window.turnstile) {
        try { window.turnstile.remove(turnstileWidgetId.current); } catch { /* Safe cleanup. */ }
        turnstileWidgetId.current = null;
      }
    };
  }, [showCaptcha]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) return undefined;
    let cancelled = false;
    loadScript('https://accounts.google.com/gsi/client', 'budgetry-google-identity-script')
      .then(() => {
        if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: response => {
            if (!response?.credential) { setError('Google sign-in could not be completed.'); return; }
            setGoogleCredential(response.credential);
            void completeGoogle(response.credential, '');
          },
          ux_mode: 'popup',
          auto_select: false,
        });
        googleButtonRef.current.replaceChildren();
        window.google.accounts.id.renderButton(googleButtonRef.current, { theme: document.documentElement.dataset.theme === 'dark' ? 'filled_black' : 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: 320 });
      })
      .catch(() => { if (!cancelled) setError('Google sign-in is temporarily unavailable.'); });
    return () => { cancelled = true; };
  }, [GOOGLE_CLIENT_ID]);

  async function completeGoogle(credential, totpCode) {
    setLoading(true); setError(''); setSuccess(false);
    try {
      const data = await api('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential, keepSignedIn, ...(totpCode ? { totpCode } : {}) }),
      });
      setUser(data.user);
      navigate(nextPath === '/admin' && !data.user.isAdmin ? '/' : nextPath);
    } catch (e) {
      if (e.code === 'TOTP_REQUIRED') setTwoFactorRequired(true);
      setError(e.message || 'Google sign-in could not be completed.');
    } finally { setLoading(false); }
  }

  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setError(''); setSuccess(false); setSuccessMessage('');
    if ((signup || captchaRequired) && TURNSTILE_SITE_KEY && !captchaToken) {
      setError('Complete the security check before continuing.');
      return;
    }
    if ((signup || captchaRequired) && !TURNSTILE_SITE_KEY && captchaLoadError) {
      setError('The security check is not configured. Please contact the site operator.');
      return;
    }

    const result = schema.safeParse({
      ...form,
      name: signup ? form.name : undefined,
    });
    if (!result.success) { setError(result.error.issues[0].message); return; }
    setLoading(true);
    try {
      const data = await api('/auth/' + (signup ? 'signup' : 'login'), {
        method: 'POST',
        body: JSON.stringify({
          ...result.data,
          keepSignedIn,
          ...(showCaptcha && captchaToken ? { turnstileToken: captchaToken } : {}),
          ...(twoFactorRequired && form.totpCode ? { totpCode: form.totpCode } : {}),
        }),
      });
      if (data.verificationRequired) { setSuccess(true); setSuccessMessage(data.message); return; }
      setUser(data.user); setSuccess(true); setSuccessMessage('Signed in successfully.');
      navigate(nextPath === '/admin' && !data.user.isAdmin ? '/' : nextPath);
    } catch (e) {
      if (e.code === 'CAPTCHA_REQUIRED') {
        setCaptchaRequired(true);
        setCaptchaToken('');
        if (!TURNSTILE_SITE_KEY) setCaptchaLoadError('The site security check is required but its public key is not configured. Contact the site operator.');
      }
      if (e.code === 'TOTP_REQUIRED') setTwoFactorRequired(true);
      if (showCaptcha && window.turnstile && turnstileWidgetId.current !== null) {
        try { window.turnstile.reset(turnstileWidgetId.current); } catch { /* Challenge may have expired. */ }
      }
      setError(e.message || 'Authentication could not be completed.');
    } finally { setLoading(false); }
  }

  return <section className="auth-layout">
    <div className="auth-copy">
      <span className="eyebrow">{adminLogin ? 'RESTRICTED ADMIN ACCESS' : 'YOUR MONEY, CLEARER'}</span>
      <h1>{adminLogin ? 'Sign in to the admin portal.' : signup ? 'Build better money habits.' : 'Welcome back.'}</h1>
      <p>{adminLogin ? 'Use the account approved for administrator access. Regular accounts cannot view the admin dashboard.' : 'Keep track of everyday spending, spot monthly patterns, and stay in control of your data.'}</p>
      <ul><li>Private, account-based expense records</li><li>Monthly summaries and CSV export</li><li>No advertising or behavioural analytics</li></ul>
    </div>
    <form className="panel auth-card" onSubmit={submit} noValidate>
      <h2>{signup ? 'Create your account' : adminLogin ? 'Administrator sign in' : 'Sign in'}</h2>
      <p className="muted">{signup ? 'Start tracking in a few minutes.' : adminLogin ? 'The server checks your account against the admin allowlist.' : 'Access your personal Budgetry dashboard.'}</p>
      {signup && <div className="field"><label htmlFor="name">Name</label><input id="name" autoComplete="name" value={form.name} maxLength={80} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>}
      <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" value={form.email} maxLength={254} onChange={e => setForm({ ...form, email: e.target.value })} aria-describedby={error ? 'auth-error' : undefined} required /></div>
      <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} value={form.password} maxLength={128} onChange={e => setForm({ ...form, password: e.target.value })} aria-describedby={error ? 'auth-error' : 'password-hint'} required /><small id="password-hint" className="muted">{signup ? 'Use at least 10 characters.' : 'Enter your account password.'}</small></div>
      {!signup && <label className="keep-signed-in"><input type="checkbox" checked={keepSignedIn} onChange={e => setKeepSignedIn(e.target.checked)} /> Keep me signed in on this device</label>}
      {!signup && twoFactorRequired && <div className="field"><label htmlFor="auth-totp">Authenticator code</label><input id="auth-totp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={form.totpCode} onChange={e => setForm({ ...form, totpCode: e.target.value.replace(/\D/g, '').slice(0,6) })} aria-describedby="totp-hint" required /><small id="totp-hint" className="muted">Enter the six-digit code from your authenticator app.</small>{googleCredential && <button type="button" className="button button-secondary" onClick={() => completeGoogle(googleCredential, form.totpCode)} disabled={loading}>Finish Google sign-in</button>}</div>}
      {(signup || captchaRequired) && TURNSTILE_SITE_KEY && <div className="turnstile-panel"><div ref={turnstileRef} aria-label="Cloudflare Turnstile security verification" />{captchaLoadError && <p className="form-error" role="alert">{captchaLoadError}</p>}<small className="muted">Protected by Cloudflare Turnstile. See the Privacy Policy.</small></div>}
      {(signup || captchaRequired) && !TURNSTILE_SITE_KEY && captchaRequired && <p className="muted captcha-config-note">Security verification is required for this attempt, but the public Turnstile site key is not configured.</p>}
      {error && <p className="form-error" id="auth-error" role="alert">{error}</p>}
      {success && <p className="form-success" role="status">{successMessage || 'Success.'}</p>}
      <button className="button button-primary button-full" disabled={loading || (captchaRequired && !TURNSTILE_SITE_KEY && Boolean(captchaLoadError))}>{loading ? <><span className="spinner spinner-small" />Working…</> : signup ? 'Create account' : twoFactorRequired ? 'Verify and sign in' : 'Sign in'}</button>
      {!signup && GOOGLE_CLIENT_ID && <><div className="auth-divider"><span>or</span></div><div className="google-signin-wrap"><div ref={googleButtonRef} aria-label="Continue with Google" /></div></>}
      {!signup && <p className="auth-switch"><Link to="/forgot-password">Forgot password?</Link> · <Link to="/verification-request">Resend verification email</Link></p>}
      <p className="auth-switch">{signup ? 'Already registered?' : 'New here?'} <Link to={signup ? '/login' : '/signup'}>{signup ? 'Sign in' : 'Create an account'}</Link></p>
    </form>
  </section>;
}
