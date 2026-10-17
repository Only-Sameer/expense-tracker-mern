import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../api.js';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80, 'Name must be 80 characters or fewer.').optional(),
  email: z.string().trim().max(254).pipe(z.email({ error: 'Enter a valid email address.' })),
  password: z.string().min(10, 'Use at least 10 characters.').max(128).refine(value => new TextEncoder().encode(value).length <= 72, 'Password must be no more than 72 UTF-8 bytes.'),
});
export default function Auth({ mode, setUser }) {
  const signup = mode === 'signup';
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault(); if (loading) return;
    setError(''); setSuccess(false);
    const result = schema.safeParse({ ...form, name: signup ? form.name : undefined });
    if (!result.success) { setError(result.error.issues[0].message); return; }
    setLoading(true);
    try {
      const data = await api(`/auth/${signup ? 'signup' : 'login'}`, { method: 'POST', body: JSON.stringify(result.data) });
      setUser(data.user); setSuccess(true); navigate('/');
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  return <section className="auth-layout"><div className="auth-copy"><span className="eyebrow">YOUR MONEY, CLEARER</span><h1>{signup ? 'Build better money habits.' : 'Welcome back.'}</h1><p>Keep track of everyday spending, spot monthly patterns, and stay in control of your data.</p><ul><li>Private, account-based expense records</li><li>Monthly summaries and CSV export</li><li>No advertising or analytics trackers</li></ul></div>
    <form className="panel auth-card" onSubmit={submit} noValidate><h2>{signup ? 'Create your account' : 'Sign in'}</h2><p className="muted">{signup ? 'Start tracking in a few minutes.' : 'Access your personal expense dashboard.'}</p>
      {signup && <div className="field"><label htmlFor="name">Name</label><input id="name" autoComplete="name" value={form.name} maxLength={80} onChange={e => setForm({ ...form, name: e.target.value })} aria-describedby={error ? 'auth-error' : undefined} required /></div>}
      <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" value={form.email} maxLength={254} onChange={e => setForm({ ...form, email: e.target.value })} aria-describedby={error ? 'auth-error' : undefined} required /></div>
      <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} value={form.password} maxLength={128} onChange={e => setForm({ ...form, password: e.target.value })} aria-describedby={error ? 'auth-error' : 'password-hint'} required /><small id="password-hint" className="muted">{signup ? 'Use at least 10 characters.' : 'Enter your account password.'}</small></div>
      {error && <p className="form-error" id="auth-error" role="alert">{error}</p>}
      {success && <p className="form-success" role="status">Success.</p>}
      <button className="button button-primary button-full" disabled={loading}>{loading ? <><span className="spinner spinner-small" />Working…</> : signup ? 'Create account' : 'Sign in'}</button>
      <p className="auth-switch">{signup ? 'Already registered?' : 'New here?'} <Link to={signup ? '/login' : '/signup'}>{signup ? 'Sign in' : 'Create an account'}</Link></p>
    </form>
  </section>;
}
