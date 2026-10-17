import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export function Header({ user, theme, onThemeToggle, onLogout }) {
  const [profileOpen, setProfileOpen] = useState(false);
  return <header className="site-header">
    <Link className="brand" to="/" aria-label="Budgetry home"><img src="/budgetry-logo.webp" alt="Budgetry" className="brand-logo" /><span className="sr-only">Know where your money goes.</span></Link>
    <div className="header-tagline">Know where your money goes.</div>
    <div className="header-actions">
      <button className="icon-button theme-toggle" onClick={onThemeToggle} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} aria-pressed={theme === 'dark'}>{theme === 'dark' ? '☀' : '☾'}</button>
      {user ? <div className="profile-menu-wrap">
        <button type="button" className="profile-avatar-button" onClick={() => setProfileOpen(value => !value)} aria-label="Open account menu" aria-expanded={profileOpen}><span className="avatar">{(user.name || 'B').slice(0,1).toUpperCase()}</span><span className="profile-name-short">{user.name?.split(' ')[0] || 'Account'}</span><span aria-hidden="true">⌄</span></button>
        {profileOpen && <div className="profile-dropdown" role="menu"><div className="profile-dropdown-user"><strong>{user.name}</strong><span>{user.email}</span></div>{user.isAdmin && <Link role="menuitem" to="/admin" onClick={() => setProfileOpen(false)}>Admin console</Link>}<button type="button" role="menuitem" onClick={() => { setProfileOpen(false); onLogout(); }}>Log out</button></div>}
      </div> : <Link className="button button-primary header-signin" to="/login">Sign in</Link>}
    </div>
  </header>;
}
export default Header;
