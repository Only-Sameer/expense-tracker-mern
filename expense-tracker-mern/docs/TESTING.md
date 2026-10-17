# Manual verification checklist

## Install and smoke tests
- [ ] Use supported Node version and MongoDB.
- [ ] Copy `.env.example` files and use a unique 32+ character JWT secret.
- [ ] From the root, run `npm install`; commit the resulting `package-lock.json` before deployment (it could not be generated here because the registry request timed out).
- [ ] Run `npm test` in server and `npm run build` in client.
- [ ] Start both servers; verify `/api/health` and app load.
- [ ] Sign up, log out, log in; check wrong password and duplicate email errors.
- [ ] Create, edit, delete expenses; test invalid amount/date/note lengths.
- [ ] Create two accounts and confirm neither can read, edit, export, or delete the other's expenses.
- [ ] Test category/date filters, note search, all sort modes, pagination, monthly chart, CSV and JSON exports.
- [ ] Test account deletion and verify user and expenses are absent from MongoDB.

## Security and privacy
- [ ] Inspect DevTools > Application > Cookies: auth cookie is HttpOnly; Secure is enabled in production; SameSite matches deployment.
- [ ] Confirm JWT is not in localStorage/sessionStorage.
- [ ] Inspect localStorage: only `expense-theme` and `expense-cookie-consent` are expected.
- [ ] Confirm no analytics/ad scripts or non-essential cookies are loaded before consent.
- [ ] Check CORS rejects untrusted origins; unsafe requests with wrong/missing Origin are rejected.
- [ ] Test auth rate limit and response behavior.
- [ ] Run `npm audit`; review production dependency tree and headers.
- [ ] Test CSV formula injection using notes beginning with `=`, `+`, `-`, or `@`.
- [ ] Test backups and restore, account deletion retention, and logs for accidental secrets.

## Accessibility and responsive
- [ ] Run Lighthouse on dashboard, login, signup, and legal pages.
- [ ] Run axe DevTools; fix all critical/serious findings.
- [ ] Keyboard-only: skip link, links, buttons, filters, forms, mobile menu, consent panel, dialogs, pagination.
- [ ] Verify visible focus and no keyboard traps.
- [ ] Screen-reader spot check with NVDA + Firefox/Chrome and VoiceOver + Safari.
- [ ] Test 320px width, 200% zoom, landscape mobile, touch target size, and horizontal table scrolling.
- [ ] Test prefers-reduced-motion and both system theme preferences.
- [ ] Verify light/dark contrast for every actual control and state; fix the known light border issue.
- [ ] Confirm error text is announced and linked to the relevant input; improve per-field validation as needed.
- [ ] Check chart has an understandable text alternative or accompanying monthly data table.
- [ ] Verify back-to-top visibility behavior and mobile menu focus restoration.

## Deployment
- [ ] Set Render `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, `COOKIE_SECURE`, `COOKIE_SAME_SITE`, and `NODE_ENV=production`.
- [ ] Set Vercel `VITE_API_URL` to the deployed API URL and redeploy.
- [ ] Use HTTPS and exact origins; test browser third-party-cookie blocking.
- [ ] Configure MongoDB network access and least-privilege DB user.
- [ ] Add production logs/alerts, backup schedule, retention schedule, and incident contact.
