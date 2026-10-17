# Requirements coverage (honest starter assessment)

| # | Requirement | Status | Files / notes |
|---|---|---|---|
| 1 | Auth + CRUD + search/filter/sort/page/chart/CSV | Partial | `server/src/routes/*`, `client/src/pages/*`; search currently searches note text only; automated integration tests not included. |
| 2.1 | Dark mode and saved preference | Done | `client/index.html`, `client/src/hooks.js`; storage may be unavailable, fallback is light. |
| 2.2 | Cookie banner and choices | Partial | `client/src/App.jsx`; “manage” currently records a managed choice, no category toggles because no non-essential scripts exist. |
| 2.3 | Site and expense search | Partial | `App.jsx`, `Dashboard.jsx`; page search matches a small fixed list and expense search matches notes. |
| 2.4 | Back to top after ~300px | Done | `App.jsx`; passive scroll listener throttled with `requestAnimationFrame`, reduced-motion preference respected. |
| 2.5 | Mobile menu behavior | Partial | `App.jsx`; focus loop and scroll lock exist; outside click closes, but focus restoration and focusable-element edge cases need manual validation. |
| 2.6 | Skeleton/spinners/page loader/reduced motion | Done | `Dashboard.jsx`, `Auth.jsx`, `App.jsx`, `styles.css`. |
| 2.7 | Interactive states | Partial | `styles.css`; hover/focus/active coverage should be checked with axe and touch devices. |
| 2.8 | Scroll progress | Done | `hooks.js`, `App.jsx`. |
| 2.9 | Privacy policy | Done | `Legal.jsx` template; legal review required. |
| 2.10 | Terms | Done | `Legal.jsx` template; legal review required. |
| 2.11 | Cookie inventory | Partial | `Legal.jsx`; verify deployed cookies and storage inventory. |
| 2.12 | Consent persistence/change, no trackers | Partial | `App.jsx`; no optional scripts; policy version/timestamp stored. Banner reopens after choice changes via footer. |
| 2.13 | Data minimization/export/deletion | Partial | `User.js`, `Expense.js`, `auth.js`; hosting/security logs and backups depend on provider. |
| 2.14 | WCAG AA contrast table | Partial | `docs/CONTRAST.md` provides computed key token pairs, not every possible browser-rendered combination; test rendered states. |
| 2.15 | Button states/double submit | Partial | `Auth.jsx`, `Dashboard.jsx`; destructive action lacks dedicated loading state. |
| 2.16 | Maintained dependencies/browser support | Partial | Direct versions are pinned in root/client/server `package.json`; Vite/React/Express/Mongoose/Zod versions reviewed against current release pages. Lockfile and `npm audit` remain pending because the registry timed out; browser matrix not run. |
| 2.17 | Risk review | Done | `docs/SELF_REVIEW.md`. |
| 3 | Legal templates incl. India / GDPR-style rights | Partial | `Legal.jsx`; placeholders and legal counsel review required. |
| 4 | Accessibility/responsive/SEO/env | Partial | client files and `.env.example`; OG image omitted; verify all breakpoints and assistive tech manually. |
