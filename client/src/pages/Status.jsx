import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const CHECK_INTERVAL_MS = 60_000;

/**
 * Public service-status snapshot. It checks the API health/readiness endpoint only;
 * it does not send analytics, browser identifiers, or expense data.
 */
export default function Status() {
  const [health, setHealth] = useState(null);
  const [checkedAt, setCheckedAt] = useState(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const checkHealth = useCallback(async () => {
    setChecking(true);
    try {
      const result = await api('/health');
      setHealth(result);
      setError('');
    } catch (cause) {
      setHealth(null);
      setError(cause?.message || 'The service could not be reached.');
    } finally {
      setCheckedAt(new Date());
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkHealth();
    const timer = window.setInterval(() => { void checkHealth(); }, CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [checkHealth]);

  const available = health?.status === 'ok';
  const stateLabel = checking && !health && !error ? 'Checking' : available ? 'Operational' : error ? 'Could not reach API' : 'Checking';
  const stateTone = available ? 'operational' : error ? 'outage' : 'checking';

  return <section className="public-status-page" aria-labelledby="status-title">
    <div className="status-heading">
      <span className="eyebrow">BUDGETRY · SERVICE STATUS</span>
      <h1 id="status-title">Budgetry service status</h1>
      <p className="muted">A live readiness snapshot for the Budgetry API and its database. This page refreshes while it is open.</p>
    </div>

    <section className="status-overview-card">
      <div className="status-overview-row">
        <div>
          <span className={'status-indicator '+stateTone} aria-hidden="true" />
          <strong className="status-state-label">{stateLabel}</strong>
          <p className="muted">{available ? 'The API is responding and required data services are ready.' : error || (checking ? 'Checking the latest readiness response…' : 'Waiting for the first successful check.')}</p>
        </div>
        <button type="button" className="button button-secondary" onClick={checkHealth} disabled={checking}>{checking ? 'Checking…' : 'Check now'}</button>
      </div>

      <div className="status-components">
        <div className="status-component-row"><span>Budgetry API</span><strong className={available ? 'status-value-ok' : 'status-value-error'}>{available ? 'Operational' : error ? 'Unreachable' : 'Checking'}</strong></div>
        <div className="status-component-row"><span>MongoDB</span><strong className={health?.database === 'connected' ? 'status-value-ok' : 'status-value-error'}>{health?.database === 'connected' ? 'Connected' : health?.database || 'Unknown'}</strong></div>
        <div className="status-component-row"><span>Shared Redis</span><strong>{health?.redis === 'connected' ? 'Connected' : health?.redis === 'not_configured' ? 'Not configured (database fallback)' : health?.redis || 'Unknown'}</strong></div>
      </div>

      <p className="status-last-checked">Last check: {checkedAt ? checkedAt.toLocaleString('en-IN') : 'Not checked yet'} · Auto-refresh every 60 seconds while this page is open.</p>
    </section>

    <section className="status-note">
      <h2>About this status page</h2>
      <p>This reports the latest readiness check, not a historical uptime percentage or a guarantee that every user flow is working. The scheduled GitHub Actions probe is a separate lightweight check; an independently hosted monitoring/status provider can add history and incident alerts.</p>
      <Link to="/" className="button button-primary">Back to Budgetry</Link>
    </section>
  </section>;
}
