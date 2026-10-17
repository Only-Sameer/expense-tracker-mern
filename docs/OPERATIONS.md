# Budgetry operations and release runbook

This runbook separates the currently deployed Render topology from the three-instance local scale demo. **Do not claim high availability, multi-instance scaling, a passed restore drill, or a Lighthouse score until those items have been configured and measured.**

## Service topology

~~~mermaid
flowchart LR
  B[Browser] --> W[Render static site]
  W -->|HTTPS API and HttpOnly cookies| A[Render API service]
  A -->|user-scoped queries and aggregates| M[(MongoDB Atlas)]
  A -. optional shared control store .-> R[(Redis or MongoDB-backed counters/cache)]
  GH[GitHub Actions health ping] --> H[/health/]
  H --> A
~~~

The repository config uses the current Render site and API names. The free Render plan is single-instance; the API scale demo below is separate.

### Local three-replica scale demonstration

~~~mermaid
flowchart LR
  B[Browser] --> N[Nginx round-robin proxy]
  N --> A1[Express API 1]
  N --> A2[Express API 2]
  N --> A3[Express API 3]
  A1 --> R[(Redis)]
  A2 --> R
  A3 --> R
  A1 --> M[(MongoDB)]
  A2 --> M
  A3 --> M
~~~

Run it from the repository root:

~~~bash
docker compose up --build
~~~

Open http://localhost:8080. Use docker compose ps, docker compose logs -f api1 api2 api3 web, and docker compose down to inspect or stop the local demo. The named MongoDB and Redis volumes persist across restarts. docker compose down -v deletes those local volumes, so do not use -v unless you intentionally want to erase local demo data.

Nginx uses round-robin upstream selection plus passive max_fails / fail_timeout handling. Compose runs per-container /health checks and starts Nginx after all three API replicas report healthy. OSS Nginx does not provide Nginx Plus-style active upstream health checks; this demo combines container health checks with passive proxy failure handling.

## Session migration note

The previous production release issued access JWTs without server-side session IDs. The hardened middleware intentionally rejects those legacy tokens, so existing users may need to sign in once after this release. Their saved expense records remain in MongoDB; the release does not delete expense data on sign-in renewal.

## Render scale-out

1. Open the API service in Render Dashboard and use **Compute → Manual Scaling** to choose two or more instances. Render's free plan is single-instance; scaling requires a plan that supports multiple instances.
2. Keep every instance on the same production deployment and set the same MONGODB_URI, JWT_SECRET, TOTP_ENCRYPTION_KEY, CLIENT_ORIGIN, and optional integration keys.
3. Configure a shared Redis instance or Upstash-compatible REST endpoint. Current code uses Redis first for auth counters, lockouts and shared aggregate cache; MongoDB-backed counters/cache are the shared fallback. Do not add per-instance in-memory sessions or counters.
4. Keep session and refresh-token state in MongoDB. Because the API does not depend on process-local sessions, sticky sessions are not required.
5. Keep app.set('trust proxy', 1) aligned with the one trusted reverse-proxy hop in Render. If the proxy topology changes, review this setting and verify the IP recorded in logs before deployment.
6. Keep COOKIE_SECURE=true. The current frontend and API use separate Render hostnames, so their cookie configuration currently uses COOKIE_SAME_SITE=none with Secure cookies. If you later put the website and API under a same-site custom domain (for example, app.example.com and api.example.com), use COOKIE_SAME_SITE=lax and retest sign-in, refresh and logout in real browsers. Never combine SameSite=None with Secure=false.

Render documentation: [Scaling services](https://render.com/docs/scaling), [Health checks](https://render.com/docs/health-checks).

## Required production environment

Set variables in Render Dashboard → the relevant service → Environment. Never commit .env files or paste secret values into issues, screenshots or the README.

| Variable | Service | Purpose |
|---|---|---|
| NODE_ENV=production | API | Enables production behavior and secure headers |
| MONGODB_URI | API | MongoDB Atlas URI for expense_tracker; use a least-privilege database user |
| JWT_SECRET | API | Stable random signing secret, at least 32 characters; store only in the API environment |
| CLIENT_ORIGIN | API | Exact public frontend origin, including https:// |
| COOKIE_SECURE=true | API | Secure production cookies |
| COOKIE_SAME_SITE=none | API | Required by the current separate Render hostnames; see same-site custom-domain guidance above |
| ACCESS_TOKEN_TTL=15m | API | Short-lived access session |
| REFRESH_TOKEN_DAYS=30 | API | Sliding refresh lifetime when “Keep me signed in” is checked |
| REFRESH_TOKEN_SHORT_HOURS=12 | API | Shorter refresh lifetime when it is unchecked |
| ADMIN_EMAILS | API | Comma-separated email allowlist for administrator access |
| REDIS_REST_URL + REDIS_REST_TOKEN | API | Optional shared Redis/Upstash control store for rate limits, lockouts and aggregate cache |
| RESEND_API_KEY + EMAIL_FROM | API | Optional verified sender for email verification and password reset |
| TURNSTILE_SECRET_KEY | API | Optional Cloudflare Turnstile server-side verification key |
| GOOGLE_CLIENT_ID | API | Optional Google Identity Services client ID used to verify ID tokens |
| TOTP_ENCRYPTION_KEY | API | Stable separate secret for encrypting authenticator secrets; keep it backed up |
| SENTRY_DSN | API | Optional error-monitoring destination; empty disables API error reporting |
| VITE_API_URL | Frontend build | https://only-sameer-expense-tracker-api.onrender.com for the current split deployment |
| VITE_TURNSTILE_SITE_KEY | Frontend build | Public Turnstile site key paired with TURNSTILE_SECRET_KEY |
| VITE_GOOGLE_CLIENT_ID | Frontend build | Same Google OAuth web client ID as GOOGLE_CLIENT_ID |
| VITE_SENTRY_DSN | Frontend build | Optional browser error-reporting DSN; empty disables browser reporting |

Configure either REDIS_URL or both REDIS_REST_URL and REDIS_REST_TOKEN, not both. REDIS_URL=redis://redis:6379 is for the Docker Compose network; use an authenticated TLS endpoint or HTTPS REST endpoint for a hosted Redis service.

TOTP_ENCRYPTION_KEY must remain stable after a user enables 2FA. Rotating it without a migration makes existing stored authenticator secrets undecryptable.

### Optional provider setup

- **Cloudflare Turnstile:** create a widget with the production hostname, set VITE_TURNSTILE_SITE_KEY on the frontend build and TURNSTILE_SECRET_KEY on the API, then test signup and the login challenge after three failed attempts. The server calls Siteverify; a browser token alone is never accepted. See [Cloudflare's server-side validation guidance](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
- **Google sign-in:** create a Web OAuth client, register the production origin in Google Cloud, and set the same client ID in VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID.
- **Sentry-compatible diagnostics:** set both DSNs only after reviewing the diagnostic data and regional endpoint. The code is opt-in; when enabled, it sends redacted exception details and route metadata, not expense records. Validate that the DSN's host is allowed by the deployed CSP.
- **Email:** verify the sender/domain and test verification/reset delivery to a real inbox. Keep the API key in Render environment variables.
- **Status page:** the repository includes health endpoints and a scheduled GitHub Actions health ping, but it does not create a hosted public status page or alerting account. Configure an independent uptime provider to monitor GET /health and publish its status page. Do not add an inline tracking script to Budgetry; disclose any new browser-loaded service in the policy pages first.

## Daily automated backup setup

The workflow at .github/workflows/backup.yml runs daily at 02:17 UTC and can also be started with **Actions → Encrypted MongoDB backup → Run workflow**. It backs up the expense_tracker database, encrypts the archive with age, and uploads only the encrypted archive as a GitHub Actions artifact with seven-day retention. It is deliberately not active until you configure both values:

1. GitHub repository **Settings → Secrets and variables → Actions → Secrets**: add MONGODB_URI using the production connection string.
2. Generate an age keypair on a private computer with age-keygen. Store the private identity offline and add only its public age1... recipient as repository variable BACKUP_AGE_RECIPIENT. Never commit either keypair file.
3. Run the workflow manually once. Confirm the run succeeded and that its artifact name starts with budgetry-encrypted-db-. A missing variable or failed dump intentionally fails the workflow rather than producing a fake “successful” backup.
4. Download an artifact and decrypt it on a secure workstation with the offline private identity. Test the restore script against a separate test cluster/database, never against the production target:

   ~~~bash
   age --decrypt -i /secure/path/age-identity.txt -o ./budgetry-restore.archive.gz ./budgetry-backup.archive.gz.age
   RESTORE_URI='mongodb+srv://...separate-test-cluster...' \
   CONFIRM_RESTORE_TEST=YES \
   ./scripts/restore-mongodb-test.sh ./budgetry-restore.archive.gz
   ~~~

5. Confirm the script prints each restored collection and document count, then remove the isolated test database and temporary local archive securely.

GitHub artifacts are a short-retention fallback, not a long-term archive. Keep older encrypted copies in a separate encrypted storage location if recovery requirements demand more than seven days. If Atlas offers backups for the current cluster/plan, enable them too; Atlas documents daily M0 snapshots as a separately enabled preview with limited retention, and availability can vary. See [Atlas Free Cluster Backups](https://www.mongodb.com/docs/atlas/backup/cloud-backup/free-cluster-backup/) and [Atlas backup/restore guidance](https://www.mongodb.com/docs/atlas/backup-restore-cluster/).

The manual scripts scripts/backup-mongodb.sh and scripts/restore-mongodb-test.sh require MongoDB Database Tools. They use private file permissions and the restore helper remaps collections into budgetry_restore_test.*; still inspect every URI before running the restore command.

## Cloudflare CDN for a custom domain

Render serves the current `onrender.com` hostname directly. Cloudflare proxy/CDN setup requires a custom domain you own; do not attempt to enable Cloudflare proxying on the Render-owned hostname. Follow [Render's Cloudflare DNS instructions](https://render.com/docs/configure-cloudflare-dns): add the custom domain to the Render service first, point the CNAME to the Render target in DNS-only mode, wait for Render to verify DNS and issue TLS, then optionally enable proxying. Keep Cloudflare SSL/TLS mode at least Full; use Full (strict) when the origin certificate is valid and verified. Remove conflicting AAAA records per Render's current guide.

Add Cloudflare Cache Rules in this order:

1. **Bypass cache** for `/api/*`, `/health`, `/admin*`, `/login*`, `/signup*`, `/forgot-password*`, `/reset-password*`, `/verification-request*`, and `/verify-email*`. Keep credentialed API responses private and bypassed.
2. **Cache static fingerprinted assets** at `/assets/*`, respecting origin cache-control headers. Render sends `public, max-age=31536000, immutable` for hashed Vite assets.
3. **Do not force-cache HTML**. Keep the root and `index.html` revalidating (`Cache-Control: no-cache`) so a deployment's new asset manifest is picked up. Never override a response's private/no-store policy for API or authentication paths.

Cloudflare can provide edge Brotli/gzip compression when traffic is proxied; Nginx enables gzip in the local multi-instance demo. Express and static origins can emit ETags by default, but API responses remain `Cache-Control: no-store`. Validate cache headers and CDN HIT/BYPASS behavior in DevTools after DNS changes. See [Cloudflare Cache Rules](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/) and [default cache behavior](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/).

## Load testing

Install [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/), warm the health endpoint once, and use a dedicated staging account:

~~~bash
BUDGETRY_API_URL=https://your-staging-api.example.com \
BUDGETRY_EMAIL=load-test@example.com \
BUDGETRY_PASSWORD='use-a-dedicated-test-password' \
VUS=10 DURATION=1m \
k6 run tests/load/k6-budgetry.js
~~~

The script exercises GET /api/auth/me, page-one expense queries and the monthly aggregate endpoint after a sign-in during setup. It never prints the password or session token. Do not load-test production with a personal account or on a free plan.

For your README or interview slide, save screenshots of: active VUs, requests/second, p95 and p99 latency, http_req_failed, checks passed/failed, cold-start run versus warm run, and the instance count. Capture the test date, commit SHA and environment beside the chart. A target in the script is p95 under 1.2 seconds and p99 under 2.5 seconds for a warmed test; treat it as a goal to measure, not an achieved result.

## Staging and production release checklist

- Create a separate Render static site and API for staging, connected to the staging branch. Use a separate Atlas database/user and a separate email/Turnstile/OAuth configuration; do not point staging at production data.
- Run GitHub Actions CI before merging to main; Render auto-deploys the production branch when the new commit passes its configured deploy rules.
- Verify /health, signup, sign-in, session refresh, CRUD, export/import, admin allowlist, account deletion and legal routes in a real browser after each release.
- Confirm the deployed static response headers and the frontend CSP in DevTools. The React build and unit tests do not prove that the live page passes Lighthouse or WCAG 2.2 AA.
- Configure an independent public status page/alerts provider and test its failure notification path.
- Confirm automated backup workflow secrets are configured, take a backup, perform a restore drill against an isolated database, and record the run ID/date. Do not claim restore readiness solely because a dump job ran.
