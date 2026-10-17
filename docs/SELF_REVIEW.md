# Self-review: status and limitations

Updated 17 October 2026.

## Implemented in source

- Responsive landing/dashboard UI, local-only 60-record six-month demo, charts, expense CRUD, filters, pagination, CSV/JSON import/export, recurring rules, custom categories, browser-local category budgets/savings goals, onboarding, quick-add parsing and tags.
- Metadata, canonical URL updates, robots.txt, sitemap.xml, favicon, web app manifest, SVG social preview, skip link, theme toggle and reduced-motion styling.
- API health/readiness endpoints, bounded retries for safe reads, Render health probe and graceful Node/Mongoose shutdown.
- bcrypt password hashes, HttpOnly short-lived access cookie, rotating hashed refresh tokens, server-side sessions and reuse detection, email verification/reset flows, optional Google ID-token verification, optional Turnstile Siteverify, TOTP, active-session revocation and audit events.
- Origin checking, Helmet API headers and static-site response security headers; Zod request validation and user-scoped database queries.
- Redis/Upstash adapter plus atomic MongoDB fallback for auth counters and aggregate caches; per-user summary cache versioning; user/date and user/category/date expense indexes.
- Dockerfile, Docker Compose three-replica Nginx demo, k6 scenario, backup/restore scripts, optional encrypted scheduled backup workflow, CI and docs for operations/interviews.

## Required configuration before calling optional services active

1. Turnstile: configure the frontend public site key and matching server secret key, then test signup and challenge after failed logins.
2. Google sign-in: configure a Google Web OAuth client ID in both frontend build and API service; test popup behavior on each intended hostname.
3. Email verification/password reset: configure a verified Resend sender and API key, then test real inbox delivery and expired/reused tokens.
4. Redis fast path: configure Redis/Upstash for hosted performance. MongoDB-backed shared counters/cache remain the fallback.
5. Sentry-compatible diagnostics: set DSNs only after reviewing policy disclosures and deployed CSP.
6. Automated encrypted backup workflow: configure the GitHub MONGODB_URI secret and BACKUP_AGE_RECIPIENT variable. The private age identity must be held offline.

## Items not yet verified

- A full Chromium end-to-end flow across sign-up, refresh rotation, add/edit/delete, CSV preview/import, account deletion, Google OAuth and Turnstile challenge.
- Real inbox email delivery and Google/Turnstile provider configuration.
- A measured Lighthouse score of 90+ on all four categories, a complete WCAG 2.2 AA audit, axe scan, screen-reader review and viewport testing from 360px to 1920px.
- A measured k6 load test on an appropriately provisioned service, including cold and warm runs, p95/p99 latency and error rate.
- A completed backup and restore drill into a separate test database, plus an independently hosted public status page and alert path.
- Render scale-out is plan-dependent; the free service remains single-instance. The local Compose stack demonstrates three replicas behind Nginx.
- Budget limits, custom category palettes and savings goals remain local preferences, scoped per account on that browser rather than synced to the server.
- The dashboard loads query-paginated expense history in bounded batches for full-history charts and filters. Very large histories should move to cursor pagination and aggregate-driven UI.
- Current deployed behavior must be tested after the new commit is pushed and deployed. Do not treat an earlier deployed commit's status as proof that this new release passed.

## Security and privacy caveats

- Keep MongoDB access allowlists restrictive and the database user least-privileged.
- Keep JWT_SECRET, TOTP_ENCRYPTION_KEY, Resend key, Redis token and private backup identities outside Git.
- TOTP_ENCRYPTION_KEY must remain stable for existing encrypted TOTP secrets.
- Cookie SameSite setting depends on the frontend/API site relationship. Current separate Render hostnames use Secure + SameSite=None; SameSite=Lax should be adopted only after moving to a same-site custom domain and testing the complete auth flow.
- The app is a portfolio expense tracker, not a regulated financial product. Perform an independent security review before storing financial data for real-world customers.
