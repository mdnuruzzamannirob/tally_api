# Email and notifications

## Setup

The backend uses the provider selected by `EMAIL_PROVIDER`; all provider adapters
share the same verification, password-reset and notification templates. The
frontend contains only public API/application URLs; keep API keys, OAuth secrets,
passwords and webhook secrets in the backend environment or the hosting platform.

Local `.env` and `.env.production` contain separate provider sections. Fill only
the selected provider's credentials and sender. The selected provider's `*_FROM`
must be verified/allowed by that provider; there is deliberately no shared sender
fallback for real delivery providers.

| `EMAIL_PROVIDER` | Required settings                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `brevo`          | `BREVO_API_KEY`, `BREVO_FROM`                                                               |
| `resend`         | `RESEND_API_KEY`, `RESEND_FROM`                                                             |
| `sendgrid`       | `SENDGRID_API_KEY`, `SENDGRID_FROM`                                                         |
| `mailgun`        | `MAILGUN_API_KEY`, `EMAIL_MAILGUN_DOMAIN`, `MAILGUN_FROM`                                   |
| `gmail`          | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_FROM`               |
| `smtp`           | `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASSWORD`, `SMTP_FROM` |
| `console`        | `EMAIL_FROM`; local/test only                                                               |

There is no shared `EMAIL_API_KEY` or custom email API URL. This prevents one
provider's key or sender from accidentally being used by another provider. No
fallback to a second provider occurs automatically.

Run `pnpm env:check` for local or `pnpm env:check:production` for production.
These validate configuration only, not provider credentials or network delivery.
Changing local `.env.production` does not update Render's environment. Restart the
local process or redeploy Render after changing environment variables.

## Brevo

Create a free Brevo account, complete account verification and request activation
of transactional email if needed. Under Settings → Senders, Domains, IPs → Senders,
add and verify `BREVO_FROM`. Under Settings → SMTP & API → API Keys, create an API
key with Transactional email sending permission and paste it into `BREVO_API_KEY`.
Use an API key, not an SMTP key. Brevo may rewrite a Gmail sender; account approval
and inbox delivery are not guaranteed. Monitor Brevo's own transactional dashboard.

## Gmail API

Enable Gmail API in Google Cloud and create a web OAuth client with
`https://developers.google.com/oauthplayground` as an authorized redirect URI.
In OAuth Playground use your own OAuth credentials, request only
`https://www.googleapis.com/auth/gmail.send`, authorize the sending account and
exchange the code for a refresh token. Store the client ID, client secret, refresh
token and Gmail sender in the backend environment. External OAuth apps in Testing
may receive refresh tokens that expire after seven days. Gmail API uses HTTPS; it
does not require an SMTP port or a custom domain.

## Local and production

Local development uses `tally`; automated tests use a separate `tally_test`
database on the same local PostgreSQL server. The production database is separate.
Docker uses `POSTGRES_*` to configure its local database; the application connects
through `DATABASE_URL`. The optional `MIGRATION_DATABASE_URL` is a connection to
the same target database with another role/direct endpoint, not another database.

From `tally_api`, run `pnpm env:check`, start PostgreSQL with
`docker compose up -d postgres` (use `sudo` if your Docker setup requires it), run
`pnpm db:setup`, then `pnpm dev`. Apply test migrations separately with
`NODE_ENV=test pnpm db:deploy`. Run `pnpm dev` in `tally_web` and open localhost:3000.
Existing Docker volumes are not reset; create `tally_test` separately if missing.

For Render, add the selected provider's credentials and sender in its environment,
apply `pnpm db:deploy` to the intended production database before starting the
release, then deploy the backend and frontend. Keep the production database, OAuth,
JWT, URL and secure-cookie variables configured. No deployment is performed by tests.

## Behavior and operations

- Signup and resend send verification links; forgot-password sends reset links.
  Failed replacement delivery does not invalidate an earlier delivered link.
- Password changes/resets and connected-account changes produce security alerts.
  Interview changes, upcoming interviews, follow-ups and application status changes
  create notifications. Optional notification emails require user opt-in; security
  emails remain enabled for verified users. Test environment disables the worker.
- The worker polls every minute; it creates interview reminders within 24 hours and
  follow-up reminders when due. Notification jobs are stored in PostgreSQL, leased
  across replicas and retried up to five times. Provider acceptance does not mean
  inbox delivery. Render Free can sleep, so scheduled reminders can be delayed.
- `GET /api/v1/notifications` lists the latest 50 items and unread count;
  `PATCH /api/v1/notifications/:id/read` and `/read-all` mark owned items read.
- Resend alone has a delivery-event endpoint at `/api/v1/webhooks/resend` and
  optional `RESEND_WEBHOOK_SECRET`; other providers' webhooks are not integrated.
  A local HTTPS tunnel is required only for incoming webhook tests, not sending.
- Resend retries certain temporary errors with an idempotency key. Other provider
  requests are not retried inline; notification jobs may retry after failure.
  Ambiguous failures can cause duplicate messages for providers without idempotency.
  Delivery events and inbox notifications have no automatic retention policy.

Provider-specific quotas, verified senders and account approval apply. Automated
tests mock providers; after setup, test signup, verification, password reset,
notification opt-in, a scheduled interview and the inbox with an account you own.
Never paste secrets into chat or source control.
