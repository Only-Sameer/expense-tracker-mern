# Budgetry testing guide

## Automated checks

Run from the repository root:

~~~bash
npm ci
npm run lint
npm test
npm run build
npm audit --omit=dev --audit-level=high
~~~

GitHub Actions runs lint, server/client tests, production build and the production dependency audit on pushes and pull requests to main/staging.

## Unit tests currently covered

- INR formatting with Indian digit grouping.
- Totals, category/date/search filtering and sort.
- Budget threshold boundaries.
- CSV quoting, escaped quotes, multi-line values and spreadsheet formula-injection protection.
- Six-month, 60-entry demo fixture.
- Calendar-day formatting without a UTC date shift.
- Quick-add parsing and invalid calendar dates.
- Server signup/expense validation, date validation, category rename and import batch limit.
- Administrator email allowlist checks.

## Manual browser release test

Use a configured staging environment and a browser profile with no existing Budgetry cookies/storage.

1. Open the public landing page in light and dark system preference. Verify title, logo, hero, preview, Try demo, Sign up, footer, legal links, font loading and narrow 360px viewport.
2. Try demo. Verify it contains 60 sample records spanning six months, add/edit/delete/import work locally, reset restores the fixtures, and no network write is sent to expense endpoints.
3. Sign up, verify CAPTCHA if configured, verify email if Resend is configured, and then sign in. Test refresh after the access session expires or by using a staging test path. Inspect cookies in DevTools: auth cookies must be HttpOnly and Secure in production; no token should be stored in localStorage.
4. Complete the first-run wizard, add an expense using quick-add text, and test date boundaries, amount validation, 300-character notes, tags, keyboard Enter, Escape and focus return.
5. Search by note/category/tag. Change category, date range and sort, move between pages, and inspect mobile card layout. Verify no horizontal scroll at 360px and 1920px widths.
6. Add and rename a custom category, create category and monthly budgets, make a savings goal, then sign out and sign in to the same account. Confirm account-scoped browser preferences stay separate when testing a second account in the same browser.
7. Add a recurring rule due today in staging and request the recurring list twice. Confirm only one expense is materialized for the rule/month.
8. Test CSV export/import with valid records, empty file, malformed date, invalid amount, unknown category, duplicate rows and formula-like text. Verify preview and cancellation do not save rows.
9. In Settings, check active sessions, revoke another session, log out all sessions and verify the typed DELETE flow rejects an incorrect confirmation/password. For a test account, verify successful deletion removes the user and associated data.
10. Try unauthorised requests to expense and admin APIs. Confirm they fail without valid sessions, and a non-allowlisted user cannot access Admin APIs.
11. Verify Privacy, Terms and Cookie pages disclose all configured providers. Inspect cookies, network requests and Content-Security-Policy headers.
12. Confirm /health reports database readiness, then perform the k6 run and the encrypted backup/restore drill in a separate test database.

## Accessibility and performance checks

- Run Lighthouse for Performance, Accessibility, Best Practices and SEO on both mobile and desktop. Record actual scores and test conditions.
- Run axe, keyboard-only navigation and screen-reader checks. Verify dialog focus containment/return, accessible chart text/legends, labels, error announcements, focus visibility, contrast and reduced-motion behavior.
- Measure cold-start and warmed requests separately. Save screenshots of VUs, req/s, p95/p99 latency, failure rate, checks and instance count.
- Test month-end dates in multiple timezone configurations.
- Do not report a score, provider integration or restore drill as complete unless the test was actually run and recorded.
