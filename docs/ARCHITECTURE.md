# Budgetry architecture

## Runtime

- Frontend: React, Vite, React Router, Recharts and custom CSS tokens. Render serves the production Vite build as a static site.
- Backend: Node.js and Express with Mongoose, MongoDB Atlas and Zod validation.
- Identity: short-lived signed access JWT in an HttpOnly cookie plus a rotating refresh cookie. Refresh tokens are stored as hashes in MongoDB and grouped by session family for reuse detection.
- Shared state: MongoDB stores users, expenses, recurring rules, sessions, refresh tokens, audit events and fallback control counters. Redis/Upstash is an optional shared fast path for auth limits and aggregate caches.
- Optional integrations: Resend email, Cloudflare Turnstile, Google Identity Services and Sentry-compatible diagnostics. Each remains inactive until its matching environment values are configured.
- Delivery: GitHub Actions CI checks lint, tests, frontend build and production dependency advisories. Render deploys the configured production branch. A scheduled health ping and an encrypted backup workflow are provided; the backup workflow requires its secrets/variables before use.

## Current production request flow

~~~mermaid
flowchart LR
  U[Browser] --> W[Render static site]
  W -->|credentialed HTTPS requests| A[Express API]
  A --> S[Auth/session middleware]
  S --> E[Expense and recurring routes]
  E --> M[(MongoDB Atlas)]
  S -. optional shared counters .-> R[(Redis/Upstash)]
  E -. short-lived aggregate cache .-> R
  E -. MongoDB fallback .-> M
  G[GitHub scheduled health probe] --> H[/health/]
  H --> A
~~~

## Local scale topology

The Docker Compose demo runs three API replicas behind Nginx, with Redis and MongoDB shared between them. Nginx uses round-robin routing and passive failure handling; Compose checks each API container's health before starting the web proxy.

~~~mermaid
flowchart LR
  U[Browser] --> N[Nginx]
  N --> A1[API 1]
  N --> A2[API 2]
  N --> A3[API 3]
  A1 --> R[(Redis)]
  A2 --> R
  A3 --> R
  A1 --> M[(MongoDB)]
  A2 --> M
  A3 --> M
~~~

This diagram illustrates local scale testing, not the number of instances currently running on the free Render deployment.

## Security and trust boundaries

- Auth middleware verifies the access token, validates a server-side session, checks the user's session version and resolves the user from MongoDB.
- All expense CRUD, exports, imports, category renames and recurring rules are scoped by the authenticated user ID.
- Admin API routes require authentication and a server-side email allowlist. Client-side navigation alone is not authorization.
- Passwords are bcrypt hashes, never plaintext. Access and refresh tokens are HttpOnly cookies; refresh tokens are hashed before database storage. Reuse of a previously rotated refresh token revokes its family.
- Unsafe methods are checked against the configured Origin. Helmet adds API security headers and the static site response rules set CSP, HSTS, X-Content-Type-Options, Referrer-Policy and frame restrictions.
- CAPTCHA tokens are verified server-side through Cloudflare Siteverify if configured. Google ID tokens are verified server-side against the configured client audience if Google login is enabled.
- Auth limits and lockouts use Redis when configured and an atomic MongoDB counter collection otherwise. They do not rely on process-local maps.
- Optional diagnostics are disabled with empty DSNs. When enabled, Sentry-compatible events are scrubbed and limited to technical exception information; the policies disclose the data flow.

## Relevant files

- server/src/app.js: proxy trust, Helmet/CSP, CORS, Origin validation, rate limiting, /health and routes.
- server/src/index.js: MongoDB connection pool, request timeouts and graceful shutdown.
- server/src/middleware/auth.js: access-token and session verification.
- server/src/routes/auth.js: signup, login, Google identity, refresh rotation, verification/reset tokens, sessions, TOTP, audit and data export/delete.
- server/src/routes/expenses.js: user-scoped CRUD, query pagination, CSV import/export and shared monthly/category aggregates.
- server/src/routes/recurring.js: recurring rules and one-per-rule/month expense materialization.
- server/src/services/redisRest.js: Redis/Upstash adapter with shared MongoDB fallback.
- server/src/models/Session.js and RefreshToken.js: server-side session and token-family records.
- server/src/models/RateLimitCounter.js: expiring shared counters and fallback cache values.
- client/src/api.js: bounded safe-request retries and serialized refresh requests per tab.
- client/src/pages/Dashboard.jsx: dashboard state, demo, quick-add, goals, preferences, filters and export/import.
- client/src/components/BudgetryUI.jsx: forms, responsive expenses, budget panels, session controls and settings.
- client/src/lib/finance.js: INR/date/filter helpers, quick-add parser, CSV helpers, demo fixtures and budget thresholds.
- Dockerfile, docker-compose.yml and nginx/default.conf: local scale demo.
- docs/OPERATIONS.md: environment, Render, backup, restore and load-test runbook.

## Known limits

Budget limits, custom category palettes and savings goals are stored in browser localStorage scoped to the logged-in user in that browser; they do not sync across devices. Recurring rules are materialized when the user next requests the recurring endpoint on or after the due day, not by an always-running scheduler. The dashboard still loads user history in bounded query-paginated batches to support whole-history filters. A very large account should move to cursor pagination and aggregate-driven rendering.

A passing build/test suite is not a browser E2E run, Lighthouse score, WCAG conformance result, load-test result or restore drill. Those items should be measured against configured staging/production services before they are reported as complete.
