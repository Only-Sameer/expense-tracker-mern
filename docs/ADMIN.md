# Admin dashboard

## Enable access

The admin dashboard lives at `/admin`. Authorization is not based on a client-side flag: the backend protects all `/api/admin/*` routes with `requireAuth` and a normalized email allowlist.

Set `ADMIN_EMAILS` in the backend environment to one or more comma-separated email addresses. Example:

```text
ADMIN_EMAILS=owner@example.com,ops@example.com
```

For local development, place this in `server/.env`. In production, set it as an environment variable on the Render web service (Environment page). Do not put actual operator emails or secrets in public source files if you prefer not to disclose them.

After the backend has redeployed, sign out and sign in using an allowlisted email address. The `/api/auth/me` and login/signup responses include an `isAdmin` boolean computed server-side from the same allowlist. If the email is not allowlisted, direct navigation to `/admin` redirects to the regular user page and the API returns HTTP 403.

## What's shown

- Total registered users, new users in the last 30 days, total expense count, and aggregate recorded amount.
- Monthly aggregate amounts and counts.
- Aggregate amounts by expense category.
- Recently registered users and a searchable, paginated directory with registration dates and expense counts.

This screen intentionally does not display individual expense notes or transaction descriptions. Access should still be restricted to trusted administrators because account directory fields and aggregate financial statistics are sensitive operational data.

## Verify

1. Set `ADMIN_EMAILS` on the backend service.
2. Deploy the updated code to the backend and frontend.
3. Sign in using an allowlisted email and open `/admin`.
4. Sign in using a non-allowlisted account and confirm the admin link is absent; direct API requests to `/api/admin/overview` must return 403 for that account.
