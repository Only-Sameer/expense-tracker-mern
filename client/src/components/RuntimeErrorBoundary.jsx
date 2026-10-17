import React, { Component } from 'react';
import { captureException } from '../lib/telemetry.js';

/**
 * Last-resort UI for synchronous React render failures.
 * Keep this independent from the rest of the app so users never see an empty page.
 */
export default class RuntimeErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    // Show only a short message, never a stack trace, so persistent production issues are diagnosable.
    return { failed: true, errorMessage: String(error?.message || 'Unknown rendering error').slice(0, 240) };
  }

  componentDidCatch(error, info) {
    // Browser console only: never display stack traces or request/account details in the UI.
    console.error('Budgetry could not render this screen.', error?.message || 'unknown error');
    captureException(error, { component: info.componentStack || 'RuntimeErrorBoundary' });
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="runtime-error-screen" role="alert" aria-labelledby="runtime-error-title">
        <section className="runtime-error-card">
          <span className="runtime-error-mark" aria-hidden="true">!</span>
          <p className="section-kicker">BUDGETRY</p>
          <h1 id="runtime-error-title">This screen hit a snag.</h1>
          <p>Budgetry could not finish displaying this page. Your saved expenses have not been deleted.</p>
          {this.state.errorMessage && <p className="runtime-error-detail"><strong>Diagnostic:</strong> <code>{this.state.errorMessage}</code></p>}
          <p>We have recorded a helpful browser-console error. Reload after the fix is deployed.</p>
          <button type="button" className="button button-primary" onClick={() => window.location.reload()}>Reload Budgetry</button>
          <a href="/" className="runtime-error-home">Return to Budgetry home</a>
        </section>
      </main>
    );
  }
}
