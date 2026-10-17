# Budgetry — Know where your money goes

Budgetry is a responsive, privacy-minded expense tracker built as a full-stack portfolio project. It helps people record expenses in Indian rupees, understand monthly patterns, and organize budgets.

**Live app:** https://only-sameer-expense-tracker-web.onrender.com  
**API health:** https://only-sameer-expense-tracker-api.onrender.com/health  
**Public status snapshot:** https://only-sameer-expense-tracker-web.onrender.com/status  
**Repository:** https://github.com/Only-Sameer/expense-tracker-mern

![Budgetry dashboard preview — illustrative sample data](client/public/dashboard-preview.svg)

Social-share artwork is in client/public/og-image.svg with a 1200 × 630 viewBox. It is SVG artwork, not a captured production screenshot.

## Product features

- Public landing page with Try demo and Sign up actions, product highlights, dashboard preview, privacy details, and a local sample workspace.
- Anonymous demo mode with 60 realistic sample expenses over six months. Demo changes stay in browser state and do not write to the API or another visitor's records. Reset demo restores the fixtures.
- Sign up/sign in, optional email verification/password reset through Resend, administrator access controlled by a server-side email allowlist, and protected API routes.
- Add/edit/delete expense records with INR amount, category, date, 300-character note, up to eight tags, inline validation, a keyboard-friendly dialog, success feedback, and undo for deletion.
- Quick-add parsing such as “250 coffee yesterday”; parsed values are shown in the expense form before save.
- Search, category/date range filters, sort, numbered pagination, a responsive desktop table/mobile card list, and keyboard shortcuts (N to add, / to focus search).
- Four monthly stat cards, year-selectable monthly chart, category donut, spending insight, and a friendly empty state.
- Category budgets with threshold colours, a monthly budget target, recurring rules for rent/subscriptions/EMIs, and savings goals.
- Custom categories and colours, CSV import with validation/preview, CSV export including tags, JSON export, and full-data export.
- First-run setup: currency (the current product is INR-only), monthly budget, and first expense.
- Settings for appearance, active sessions, log out this device/all devices, account activity, and optional authenticator-app two-factor authentication.
- Typed DELETE confirmation and password/2FA checks for account deletion; user-scoped server deletion and an audit event.
- Privacy, Terms, Cookie Policy, cookie preference dialog, canonical/robots/sitemap/social metadata, favicon and web app manifest, keyboard focus styles, reduced-motion support, and a skip-to-content link.
- Cold-start recovery state, bounded retries for safe GETs, HTML boot-screen fallback, React render-error fallback, and /health plus /api/health endpoints.

### Data storage boundaries

Expense records, recurring rules, user records, sessions, refresh-token hashes and audit events are stored in MongoDB. Category budgets, custom category palettes, onboarding preferences and savings goals are browser-local, namespaced by account on that browser; they do not sync across browsers/devices. Recurring rule definitions and expense records are server-backed. The anonymous demo is browser-only. The app is a portfolio project, not a regulated banking or financial service.

## Technology

- **Frontend:** React, Vite, React Router, Recharts, responsive custom CSS design tokens and lazy-loaded charts.
- **Backend:** Node.js, Express, Mongoose, MongoDB Atlas and Zod.
- **Security:** bcrypt password hashes, HttpOnly cookies, short-lived access sessions, rotating hashed refresh tokens, token-family reuse detection, Origin checks on unsafe methods, Helmet headers, rate limits/lockouts, server-side validation, TOTP and an admin email allowlist.
- **Operations:** Render, GitHub Actions, MongoDB Atlas, optional Redis/Upstash, Docker Compose, Nginx and k6.
- **Optional external services:** Resend email, Cloudflare Turnstile, Google Identity Services and Sentry-compatible diagnostics. They remain inactive when their environment keys are empty. Google Fonts is loaded for the Inter typeface and is disclosed in the privacy notice.
- **No advertising or behavioural analytics:** the app does not include advertising or behavioural analytics trackers. Optional bot checks, Google sign-in and error diagnostics are separately disclosed in the policies when configured.

The existing React/Vite + Express/MongoDB stack is retained. A full framework/database migration would increase risk without materially improving this app's current product boundaries.

## Architecture

### Current hosted topology

~~~mermaid
flowchart LR
  B[Browser] --> W[Render static site]
  W -->|HTTPS API requests + cookies| A[Render Express API]
  A -->|user-scoped queries| M[(MongoDB Atlas)]
  A -. optional Redis fast path .-> R[(Redis / Upstash)]
  G[GitHub Actions health ping] --> H[/health/]
  H --> A
  B --> D[Browser-only demo records]
~~~

The deployed services are separate Render hostnames. Therefore production cookie configuration currently uses Secure cookies with SameSite=None. A same-site custom domain can allow SameSite=Lax; test sign-in, refresh and logout in real browsers before changing this.

### Local multi-instance demonstration

~~~mermaid
flowchart LR
  B[Browser] --> N[Nginx round-robin load balancer]
  N --> A1[Express API 1]
  N --> A2[Express API 2]
  N --> A3[Express API 3]
  A1 --> R[(Shared Redis)]
  A2 --> R
  A3 --> R
  A1 --> M[(MongoDB)]
  A2 --> M
  A3 --> M
~~~

The 3-instance stack is a local demonstration, configured in Docker Compose. The current Render free service runs one instance; scaling Render out requires a plan that supports multiple instances. User sessions and shared control-state are database-backed, so sticky sessions are not required.

## Run locally

Requires Node.js 20.19+ (or Node 22.12+) and MongoDB.

1. Copy server/.env.example to server/.env. Use a local MongoDB URI or a dedicated development database. Set JWT_SECRET to a random value of at least 32 characters and CLIENT_ORIGIN to http://localhost:5173. Keep real credentials out of Git.
2. Install dependencies and run checks:

   ~~~bash
   npm ci
   npm run lint
   npm test
   npm run build
   ~~~

3. In two terminals, start the API and frontend:

   ~~~bash
   npm run dev:server
   npm run dev:client
   ~~~

4. Open http://localhost:5173.

You can run the isolated load-balanced stack with Docker Compose:

Create a root-level `.env` file (already Git-ignored) containing a fresh random `JWT_SECRET` of at least 32 characters. Do not reuse the production secret. Then run:

~~~bash
docker compose up --build
~~~

Then open http://localhost:8080. Use docker compose down to stop it. docker compose down -v deletes the local MongoDB/Redis volumes.

## Environment configuration

Required for the API: NODE_ENV, MONGODB_URI, JWT_SECRET and CLIENT_ORIGIN. Production also requires COOKIE_SECURE=true. Review docs/OPERATIONS.md for the full Render variable matrix.

Optional pairs/settings:

- **Resend:** RESEND_API_KEY + EMAIL_FROM.
- **Cloudflare Turnstile:** TURNSTILE_SECRET_KEY on the API and VITE_TURNSTILE_SITE_KEY at frontend build time.
- **Google sign-in:** GOOGLE_CLIENT_ID on the API and the matching VITE_GOOGLE_CLIENT_ID at frontend build time.
- **Redis/Upstash:** REDIS_URL for Docker/local Redis, or REDIS_REST_URL + REDIS_REST_TOKEN for an HTTPS Redis REST service. Do not set both modes together.
- **2FA encryption:** TOTP_ENCRYPTION_KEY. Keep it stable and separate from JWT_SECRET; rotating it without a migration makes existing encrypted TOTP secrets undecryptable.
- **Sentry-compatible reporting:** SENTRY_DSN and VITE_SENTRY_DSN. Empty disables diagnostics. Review the deployed CSP to ensure the configured DSN endpoint is allowed.

No tokens are stored in browser localStorage. Access and refresh credentials use HttpOnly cookies. Browser-local preferences are not authentication credentials.

## Cold starts and health checks

- The HTML shell displays a branded boot state while React starts and offers a reload action if startup stalls.
- Safe GET requests receive bounded retries and a “Waking up the server…” status. Mutating requests are not blindly retried after a network error, because the result can be ambiguous.
- GET /health and GET /api/health expose readiness. Health checks inspect MongoDB and, when configured, Redis. Render is configured to use /health for API readiness.
- GitHub Actions pings /health on a schedule. This is useful as a lightweight probe, not a guarantee of uptime or a substitute for an external monitor and alerting.
- The public `/status` route shows the latest API/database readiness snapshot and refreshes while open. It is not an independent status service and does not show historical uptime. For independent history and incident alerts, configure an external uptime provider to monitor the API health URL.

## Performance and cache strategy

- Expense indexes include user/date and user/category/date, plus a uniqueness guard for one recurring entry per user/rule/month.
- List endpoints paginate against MongoDB. The dashboard currently loads user history in bounded batches for whole-history client filters and chart calculations; very large histories should move to server-side filtering/cursor pagination and summary-driven rendering.
- Monthly and category aggregate endpoints use MongoDB aggregation and a short-lived shared cache. Cache keys include a per-user version; writes to expenses, imports, category renames and recurring materialization bump that version. Cache state uses Redis when configured and MongoDB-backed shared storage otherwise, not per-process memory.
- Vite generates fingerprinted assets. Render config revalidates the entry HTML, caches fingerprinted assets, and adds security headers. Local Nginx uses gzip and long-lived caching for assets.
- Index presence and cache logic do not prove a Lighthouse score. Run Lighthouse against the deployed site on desktop and mobile before reporting a score.

## Security and privacy notes

- The server is the authority for validation, session issuance and admin checks. Every expense query is scoped to the authenticated user.
- Access tokens are short-lived. Refresh tokens rotate and are stored as hashes; replaying a used refresh token revokes its family. Session, audit and counter documents expire according to their configured TTLs.
- Authentication rate limits use Redis when configured and atomically updated MongoDB counters as the shared fallback. A Redis outage can mark readiness unhealthy when Redis is configured, even while the counter fallback remains available; inspect logs and health before calling the service healthy.
- Turnstile and Google sign-in are disabled until the matching key pairs are configured. The server verifies Turnstile tokens using Cloudflare Siteverify. Do not enable a provider without adding its data flow to the policies.
- The privacy notice discloses Google Fonts as well as any configured Turnstile, Google Identity Services and Sentry integration. No advertising or behavioural analytics trackers are included.
- Account deletion removes the application user, expenses, recurring rules, sessions and auth tokens. Security audit events have a separate retention policy; provider backups and hosting logs may retain data for their own retention period.
- Keep MongoDB network allowlists restrictive and use a least-privilege database user. Never put Atlas credentials, JWT secrets, Resend keys or private backup decryption keys in the repository.

## Automated backups and restore drills

The workflow at .github/workflows/backup.yml runs daily and uploads only an age-encrypted archive. Configure GitHub Actions secret MONGODB_URI and repository variable BACKUP_AGE_RECIPIENT before enabling it; the private age identity must be kept offline. Artifacts expire after seven days, so this is a short-retention fallback rather than a long-term archive.

The scripts under scripts/ can create a private local dump and restore it into a separate budgetry_restore_test database. Follow docs/OPERATIONS.md to decrypt an artifact, run the restore verification and record the outcome. The workflow and scripts do not prove a restore drill has passed until someone runs it against a separate test target.

## CI and testing

Run these locally:

~~~bash
npm run lint
npm test
npm run build
npm audit --omit=dev --audit-level=high
~~~

GitHub Actions repeats lint, tests, production build and the production dependency audit on pushes/pull requests for main and staging. Render production deployment is tied to the configured production branch; staging must use separate Render services, MongoDB data and credentials.

The tests cover INR Indian grouping, totals, filters/sorting, budget thresholds, CSV quoting/formula injection, demo fixture distribution, calendar-day formatting, quick-add parsing, category-name validation and server request validation. The CI build checks JSX transforms. A full Chromium flow, real OAuth/CAPTCHA/email-provider integration, axe scan, screen-reader audit, measured Lighthouse run, k6 run and restore drill still need to be performed on configured environments.

## Design decisions

1. **Incremental migration:** keep the working React/Vite and Express/MongoDB stack rather than rewrite it for fashion.
2. **Anonymous sample data:** demo records exist in browser state rather than a shared writable demo account, isolating visitors by default.
3. **Server-side access control:** client UI conditions improve usability; authentication middleware and user-scoped database queries enforce permissions.
4. **No blind write retries:** idempotent reads retry on transient connectivity errors; mutation requests are surfaced to the user instead of possibly duplicating a write.
5. **Shared state for replicas:** server-side sessions and MongoDB counter/cache fallback avoid sticky-session dependence; Redis remains the faster optional store.
6. **Explicit local preferences:** category budgets, custom colours and savings goals are account-scoped in that browser, not cloud-synced. The UI and docs state this rather than implying cross-device persistence.

## Interview preparation

Ten sample answers covering design, authentication, demo isolation, cold starts, refresh sessions, CAPTCHA, load balancing, performance, security and reliability are in [docs/INTERVIEW_QA.md](docs/INTERVIEW_QA.md).

## Five further improvements

1. Persist budgets, savings goals and custom category definitions server-side with a cross-device preference API.
2. Add automated browser E2E tests for signup/refresh, CSV preview/import, recurring entry generation, undo-delete and account deletion; add axe and screen-reader checks.
3. Run and publish measured Lighthouse desktop/mobile results, plus the k6 baseline for cold and warmed requests.
4. Add a separately hosted public status page with independent uptime alerts and documented incident response.
5. Store encrypted backups in a long-retention object store, run scheduled isolated restore drills, and add a reviewed migration/retention policy before real financial use.
