# Self-review: verified status and known limitations

Last reviewed: 17 October 2026.

## Verified from repository and service metadata

- The latest main commit on the review pass was deployed by Render; both the frontend static site and backend API reported status live.
- GitHub Actions CI for the reviewed main commit completed successfully. CI installs from the package lockfile, runs the server and client helper tests, and builds the production frontend.
- The API defines both /health and /api/health. They return HTTP 200 when MongoDB is connected and 503 when it is not.
- The authenticated API uses bcrypt password hashes, an HttpOnly cookie, session-version checks, exact Origin validation on unsafe methods, request validation, an authentication rate limiter, and user-scoped expense queries.
- Anonymous demo entries are generated in browser memory. Demo add/edit/import/delete actions do not write to the database.
- CSV import validates the file and shows a preview before batch save; server validation limits an import to 250 records and validates all rows before insertMany.
- The app has a PWA manifest, favicon, social-share SVG artwork, an illustrative landing-page dashboard preview, and a scheduled GitHub Actions health ping.

## Limitations that still need testing or configuration

1. **Browser end-to-end and Lighthouse:** CI passing is not a browser test. No real Chromium end-to-end run, full Lighthouse audit, axe scan, or screen-reader review was performed in this review. Do not claim a Lighthouse 90+ score until it is measured on the live website.
2. **Email delivery:** Email verification and password reset are implemented using Resend, but work only if both RESEND_API_KEY and EMAIL_FROM are configured in Render and the sender/domain is verified. That configuration and real inbox delivery were not confirmed here.
3. **Budget/category preferences:** Monthly budgets, custom category definitions/colours, and parts of the recurring UI state are browser-local preferences. They do not yet synchronize across browsers/devices. Expense records and recurring rules are stored server-side.
4. **Recurring timing:** Recurring rules are materialized on the next authenticated request to /api/recurring on or after the due date. This is idempotent per rule/month, but it is not a clock-triggered worker; if nobody opens the app, the entry waits until the next dashboard load.
5. **Large histories:** The dashboard fetches query-paginated records in batches to compute global summary totals and filter across the full list. For very large accounts, add summary aggregation endpoints and server-side search/filtering rather than loading every page.
6. **CSV import:** Validation and preview are implemented, and the server validates the batch before writing. Duplicate rows within a file are highlighted/countable, but comparison against previously saved expenses is not a complete duplicate-detection system.
7. **Time zones:** Calendar date helpers preserve ISO date prefixes when grouping/displaying expenses. Still manually test dates around month boundaries on devices configured in different time zones.
8. **Accessibility:** CSS tokens have calculated contrast ratios and visible focus styling; this is not proof that every chart, tinted category badge, modal, disabled state, and hover/focus state passes WCAG 2.2 AA. Verify with a rendered-page contrast tool, axe, and keyboard/screen-reader tests.
9. **Cache headers:** Static-asset caching rules can be configured with Render custom headers or through a static-site Blueprint. The existing live static service's actual response headers were not retrieved during this review. Confirm Cache-Control in browser DevTools or curl after configuring it.
10. **OG artwork:** The Open Graph artwork is SVG with a 1200 × 630 viewBox. Some third-party social previews prefer PNG/JPEG; generate a raster fallback if a target service does not display SVG.
11. **Account deletion and retention:** The API deletes the user, related expense documents, recurring rules, and auth tokens. Database backups and infrastructure/security logs follow provider retention settings and are not necessarily removed immediately.
12. **Operations:** Add structured request logs with sensitive-field redaction, uptime alerts, backup/restore drills, and a written incident contact before using this as a real financial service. The current application is a portfolio expense tracker, not a regulated banking product.

## Dependency/security housekeeping

The repository includes a package lockfile and CI. Continue reviewing dependencies with npm audit and update intentionally rather than blindly. Do not put MongoDB credentials, JWT secrets, or the Resend key in committed .env files; keep production values in Render environment variables. For a production release, confirm MongoDB network allowlisting and database-user least privilege.
