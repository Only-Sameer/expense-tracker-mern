# Budgetry — 10 interview questions and sample answers

These answers are framed around the implemented portfolio app and its known trade-offs, rather than claiming that it is a banking-grade product.

## 1. Why did you choose React, Express and MongoDB?

I kept the existing React/Vite client, Express API and MongoDB Atlas database because the app already had working expense CRUD, charts and filters. React handles interactive forms and dashboards, Express establishes an API boundary, and MongoDB is a natural fit for user-scoped expense documents. Rewriting the stack would add risk without improving the main product problem.

## 2. How do you prevent one user from reading another user's expenses?

The API authenticates the HttpOnly access cookie, loads the user server-side, and scopes expense operations with req.user._id. A client-supplied expense ID is not enough to edit or delete a record: the database query also includes the authenticated user ID. Admin APIs add a server-side email allowlist check; hiding the Admin link in React is not the authorization control.

## 3. How does a logged-out visitor try the app safely?

The demo generates 60 sample records over six calendar months in the browser. Add/edit/delete/import actions stay in demo state and never call the API, so there is no shared writable demo account. Reset demo reconstructs the fixtures. The trade-off is that demo changes don't persist across browser sessions, and demo mode does not test server-side authentication.

## 4. What happens on a Render cold start?

The HTML shell shows a loading state before React starts. The API wrapper retries safe GET requests a bounded number of times, with short backoff and a “Waking up the server” message. Mutating POST/PATCH/DELETE requests are not blindly retried because a network timeout does not prove whether the server committed the write. The API exposes /health for deployment and uptime probes.

## 5. How do you handle authentication sessions across multiple instances?

Access JWTs are short-lived and stored in an HttpOnly cookie. The rotating refresh token is also HttpOnly, is stored in MongoDB as a hash, and belongs to a server-side session/family. Refresh-token reuse revokes the token family. Sessions, refresh records, and lockout counters are not held in the Node process, so load balancing does not require sticky sessions. The deployment still needs real browser testing for cookie behavior and a configured shared Redis service for the Redis fast path.

## 6. How do CAPTCHA and rate limits help?

When configured, the browser's Cloudflare Turnstile widget produces a token and the server verifies it with the Siteverify endpoint before registration, or after repeated failed sign-in attempts. IP/account rate limits are backed by Redis if configured and otherwise by atomically updated MongoDB counter documents. The account lockout uses increasing wait durations. CAPTCHA keys are deliberately optional at code level so an unconfigured portfolio deployment does not silently send data to a third party; production should configure both the site and secret keys.

## 7. How would you scale beyond one API instance?

The API is stateless with respect to user sessions and auth counters. Render can route requests across replicas on an eligible plan; the local Compose stack demonstrates three API instances behind Nginx. MongoDB remains the persistent store, and Redis can accelerate shared rate limits and aggregate caches. Before scaling I would measure DB connection pool use, p95/p99 latency, query plans and saturation. The current Render free service itself is single-instance.

## 8. What did you do for performance?

The database uses user/date and user/category/date indexes, list endpoints paginate with skip/limit at the query layer, and the monthly/category aggregate endpoints use database aggregation. Short-lived shared cache entries are keyed by a per-user version; writes bump that version so prior entries become unreachable. The dashboard also lazy-loads charts. I would still add cursor pagination and more aggregate-driven client rendering for accounts with very large histories.

## 9. What are the main security controls and remaining risks?

Implemented controls include bcrypt password hashes, Zod server validation, Helmet security headers, CSRF origin checks, user-scoped queries, generic sign-in failures, rotating hashed refresh tokens, reuse detection, rate limiting, TOTP, a server-side admin allowlist and a typed account-deletion confirmation. Turnstile, Google OAuth and Sentry remain configuration-dependent. The remaining release risks are the lack of a measured E2E/accessibility suite, third-party configuration still needing setup, backup/restore testing, and the need for an independent security review before real financial use.

## 10. How do you prove reliability rather than just describing it?

I would show the commit SHA, passing CI run, production build, /health response, and a k6 run with VUs, throughput, p95/p99 latency and failure rate. I would compare cold and warm runs, show the configured Render instance count, and demonstrate a restore drill into a separate test database. I would not present a target Lighthouse score, a passing unit suite, or the existence of backup scripts as proof of live browser compatibility or recoverability.
