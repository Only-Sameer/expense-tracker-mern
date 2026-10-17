# Budgetry testing checklist

## Automated checks

From the repository root run:

    npm ci
    npm test
    npm run build

CI runs the same test and build commands for pushes and pull requests. Unit tests cover core INR formatting, totals, filters, sorting, budget thresholds, CSV quoting/formula-injection guards, demo data, request validation and the admin allowlist. Passing tests do not replace an end-to-end browser pass.

## Core product workflows

- [ ] Open the public landing page while logged out. Test Sign up, Sign in, and Try demo data.
- [ ] Verify demo shows 60 sample records from six months and Reset demo restores its fixture.
- [ ] In demo mode, add, edit, delete, import, export, and change budgets; verify no API mutation is made by demo operations.
- [ ] Sign up with a new email, log out, and sign in. Confirm an incorrect password has a generic error and duplicate email is rejected.
- [ ] If Resend is configured, test verification and password-reset emails with real inboxes; confirm expired/used tokens cannot be reused.
- [ ] Add/edit an expense with INR amount, all available categories, date, and a 300-character note. Try zero/negative amount, invalid dates and overlong notes.
- [ ] Test note search, category filter, from/to dates, each sort mode, page navigation and no-results state.
- [ ] Verify monthly totals/change/top category/daily average and the year selector around a December/January boundary.
- [ ] Test CSV and JSON exports. Import a valid CSV, inspect its preview, cancel it, then import it. Try malformed dates, unknown categories, formula-like cells, duplicate rows, empty CSV and more than 250 rows.
- [ ] Rename a custom category; confirm current expenses and recurring rules use the new name. Change its colour and confirm the chip/badge uses that colour.
- [ ] Create a recurring rule with due day in the current month. Confirm one generated record appears after the due date and refreshing or opening a second tab does not create another entry.
- [ ] Test budget warning colours at 79%, 80%, 99%, and 100%.
- [ ] Delete an expense and use Undo before the snackbar expires. Then delete another and confirm it stays deleted.
- [ ] In Settings, test the typed DELETE confirmation and cancel path. Only run permanent deletion against a disposable test account.
- [ ] Use two separate test accounts to verify neither can view, edit, export, or delete the other's data.
- [ ] Confirm the admin link routes through sign-in for logged-out visitors and server-side allowlisting rejects non-admin accounts.

## Security and API checks

- [ ] Confirm /health returns 200 only when MongoDB is connected and 503 when disconnected.
- [ ] Inspect the browser cookie: it should be HttpOnly and Secure in production, with SameSite matching the deployment.
- [ ] Verify the JWT is not stored in localStorage/sessionStorage.
- [ ] Inspect browser storage: expected keys include expense-theme, expense-cookie-consent, budgetry-budgets, budgetry-recurring and budgetry-custom-categories. Budget and custom-category preferences are currently browser-local.
- [ ] Send an unsafe API request with an untrusted or missing Origin and verify it is rejected.
- [ ] Exercise the login rate limit and server-side validation on invalid inputs.
- [ ] Test CSV formula injection for values beginning with =, +, - and @.
- [ ] Run npm audit. Confirm no real secrets have been committed and that Render's MongoDB URI, JWT secret and mail-provider key are environment variables.
- [ ] Verify account deletion removes the app's user, expenses, recurring rules and auth tokens; review separate provider backup/log retention.
- [ ] Use DevTools or curl to verify cache headers: hashed /assets files should have a long immutable cache, while /index.html should revalidate.

## Accessibility and responsive checks

- [ ] Run Lighthouse on the landing page, dashboard, login/signup and legal pages; record actual scores rather than assuming 90+.
- [ ] Run axe DevTools and resolve critical/serious findings.
- [ ] Keyboard-only test skip link, navigation, theme switch, forms, modal close/submit, category chips, filters, import preview, pagination, avatar menu and consent dialog.
- [ ] Confirm the N and / shortcuts do not fire when a text field/select or editable element has focus.
- [ ] Verify visible focus rings and focus restoration after dialogs/menus close.
- [ ] Test prefers-reduced-motion and system dark/light settings.
- [ ] Test 360px, 390px, tablet, 1200px and 1920px, landscape mobile, and 200% browser zoom for horizontal scrolling/overlap.
- [ ] Check text contrast and control boundaries in both themes, including custom category badges and error/toast states.
- [ ] Spot-check with a screen reader, especially chart summaries, table headers, loading/wake-up messages, and form errors.

## Render / release check

- [ ] Confirm frontend and backend deployments reference the same current main commit and have status live.
- [ ] Confirm the frontend's public screenshot/image/logo assets load and all routes survive direct navigation and browser refresh.
- [ ] Check /health after deployment.
- [ ] Confirm custom header rules in Render's static-site settings: /assets/* → Cache-Control: public, max-age=31536000, immutable; /index.html → Cache-Control: no-cache.
- [ ] Verify the keepalive workflow is enabled and has a recent successful run. A scheduled ping may be delayed; it is not an uptime SLA.
