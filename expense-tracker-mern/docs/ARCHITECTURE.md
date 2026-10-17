# Architecture

- `server/src/app.js`: Express middleware, CORS, rate limit, routing, centralized errors.
- `server/src/routes/auth.js`: signup/login/logout/current-user, export, deletion.
- `server/src/routes/expenses.js`: authenticated CRUD, filtering, paging, monthly aggregation, CSV.
- `server/src/middleware/auth.js`: verifies signed JWT from HttpOnly cookie.
- `server/src/middleware/csrf.js`: validates Origin on unsafe methods.
- `client/src/App.jsx`: routes, theme, cookie consent, responsive navigation, progress indicator.
- `client/src/pages/Dashboard.jsx`: expense UI, filters, chart and exports.
- `client/src/pages/Legal.jsx`: policy templates.
- `client/src/styles.css`: responsive design, theme tokens, reduced-motion support.

All expense reads and writes scope queries by `req.user._id`. The API is the trust boundary; client filters are only presentation.

## Deployment wiring

- Root `package.json` provides npm workspaces so Vercel can build `client/dist` from the monorepo root.
- `vercel.json` configures the static Vite output and SPA fallback. Set `VITE_API_URL` as a Vercel build environment variable.
- `render.yaml` uses `server` as the Render root directory. Set secrets and the exact frontend origin in Render's service environment.
- `.github/workflows/ci.yml` installs dependencies and runs server unit tests plus the client production build for pushes and pull requests. CI execution has not been observed in this environment.
