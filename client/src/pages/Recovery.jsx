import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';

export default function Recovery({ mode, setUser }) {
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isReset = mode === 'reset';
  const isVerify = mode === 'verify';
  const isVerifyRequest = mode === 'verification-request';

  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setError('');
    setMessage('');
    if (isReset) {
      if (!token) { setError('This reset link is missing its token. Request a new link.'); return; }
      if (password !== confirm) { setError('The passwords do not match.'); return; }
      if (password.length < 10) { setError('Use at least 10 characters.'); return; }
    }
    if (isVerify && !token) { setError('This verification link is missing its token. Open the complete link from your email.'); return; }
    setLoading(true);
    try {
      if (mode === 'forgot') {
        const result = await api('/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) });
        setMessage(result.message || 'If an account exists, a reset link has been sent.');
      } else if (isVerifyRequest) {
        const result = await api('/auth/verification-request', { method: 'POST', body: JSON.stringify({ email }) });
        setMessage(result.message || 'If the account needs verification, a link has been sent.');
      } else if (isReset) {
        const result = await api('/auth/password-reset', { method: 'POST', body: JSON.stringify({ token, password }) });
        setMessage(result.message || 'Password changed. Sign in with your new password.');
        setPassword(''); setConfirm('');
      } else if (isVerify) {
        const result = await api('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
        setUser?.(result.user);
        setMessage(result.message || 'Your email is verified. You can now use Budgetry.');
      }
    } catch (requestError) {
      setError(requestError.message || 'The request could not be completed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const title = mode === 'forgot' ? 'Reset your password' :
    isReset ? 'Choose a new password' :
    isVerify ? 'Verify your email' : 'Resend verification email';
  const intro = mode === 'forgot'
    ? 'Enter the email address on your account. If it exists, we will send a secure one-time reset link.'
    : isReset
      ? 'Choose a new password for your Budgetry account.'
      : isVerify
        ? 'Confirm that you control the email address used to register with Budgetry.'
        : 'Enter your account email and we will resend the verification link if the account still needs it.';

  return <section className="auth-layout recovery-layout">
    <div className="auth-copy">
      <span className="eyebrow">ACCOUNT SECURITY</span>
      <h1>{title}.</h1>
      <p>{intro}</p>
      <ul><li>One-time links expire automatically</li><li>Reset links can only be used once</li><li>Password changes revoke older sessions</li></ul>
    </div>
    <form className="panel auth-card" onSubmit={submit} noValidate>
      <h2>{title}</h2><p className="muted">{intro}</p>
      {(mode === 'forgot' || isVerifyRequest) && <div className="field"><label htmlFor="recovery-email">Email</label><input id="recovery-email" type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} maxLength={254} required /></div>}
      {isReset && <>
        <div className="field"><label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)} minLength={10} maxLength={128} required /><small className="muted">Use at least 10 characters.</small></div>
        <div className="field"><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={event=>setConfirm(event.target.value)} maxLength={128} required /></div>
      </>}
      {isVerify && !token && <p className="form-error" role="alert">This page needs the verification token from the email link.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      {!isVerify && <button className="button button-primary button-full" disabled={loading || (isReset && !token)}>{loading ? 'Working…' : isReset ? 'Change password' : isVerifyRequest ? 'Send verification link' : 'Send reset link'}</button>}
      {isVerify && <button className="button button-primary button-full" disabled={loading || !token}>{loading ? 'Verifying…' : 'Verify email address'}</button>}
      <p className="auth-switch"><Link to="/login">Back to sign in</Link></p>
    </form>
  </section>;
}
