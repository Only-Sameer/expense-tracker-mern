# Expense Tracker (MERN)

A privacy-conscious, accessible MERN expense tracker. Requires Node.js 20.19+ or 22.12+, and MongoDB 7+ (local or hosted).

## Quick start
1. Copy `server/.env.example` to `server/.env` and set `MONGODB_URI`, `JWT_SECRET` (32+ random bytes), `CLIENT_ORIGIN`, and `COOKIE_SECURE` (`false` for local HTTP).
2. Copy `client/.env.example` to `client/.env`.
3. From the project root, run `npm install`.
4. In one terminal run `npm run dev:server`; in another run `npm run dev:client`.
5. Open `http://localhost:5173`.

Use separate deployed origins only with careful cookie/CORS configuration. For Vercel + Render, deploy the repository root to Vercel (configured in `vercel.json`) and deploy the `server` directory to Render (configured in `render.yaml`). Set Vercel `VITE_API_URL` to the Render API URL, and set server `CLIENT_ORIGIN` to the exact Vercel origin. Use HTTPS and `COOKIE_SECURE=true`. Cross-site cookies may require `SameSite=None; Secure`; see `server/src/config/cookies.js`. Because browsers increasingly restrict third-party cookies, a custom same-site domain for frontend and API is strongly preferred for reliable cookie authentication.

## Scripts
- From the project root: `npm run dev:server`, `npm run dev:client`, `npm test`, `npm run build`.
- From `server`: `npm run dev`, `npm start`, `npm test`.
- From `client`: `npm run dev`, `npm run build`, `npm run preview`.

## Admin dashboard

The optional admin view is available at `/admin` after signing in with an email included in the server-side `ADMIN_EMAILS` environment variable. Set it in `server/.env` for local development and in Render's backend Environment settings for production. It accepts a comma-separated allowlist, for example `ADMIN_EMAILS=owner@example.com,ops@example.com`. An empty allowlist grants no admin access.

The API independently protects `/api/admin/*` with authentication and the email allowlist; hiding a frontend link is not the security control. The dashboard shows system-level aggregates and basic account directory fields. It deliberately excludes expense notes and individual transaction descriptions. Review `docs/ADMIN.md` before enabling it for production.

## Security notes
- JWT is in an HttpOnly cookie, never localStorage. Cookie-authenticated mutations use Origin checking and SameSite cookies. For production deployments where frontend and API are cross-site, review the deployment cookie mode and CSRF threat model before launch.
- Set a long random `JWT_SECRET`; never commit `.env`.
- User-owned expense queries always include the authenticated user ID.
- Account deletion is irreversible.
- Legal pages are editable templates, not legal advice. Have qualified counsel review before public launch.
- This codebase was generated as a starter and has not been independently penetration-tested or verified against every browser/device. Run the manual checklist in `docs/TESTING.md`.

## Browser support
Targets the last two stable versions of Chrome, Firefox, Safari, and Edge, plus current mobile Safari and Chrome. Uses standard React/Vite, CSS media queries, `matchMedia`, `IntersectionObserver`-free scroll handling, and `requestAnimationFrame`; test your actual target matrix.

## Structure
See `docs/ARCHITECTURE.md` and `docs/REQUIREMENTS.md`.
