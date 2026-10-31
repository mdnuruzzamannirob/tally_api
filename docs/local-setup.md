# Local and production environment setup

## What is already configured on this machine

The ignored API `.env` uses local PostgreSQL, localhost frontend/API URLs, Resend
with the existing sending API key, and the notification worker. The production
profile retains its existing database, OAuth and JWT credentials. Unused optional variables are omitted from actual env files; no placeholder
webhook secret was invented. `.env.test` has a separate test database, console
email and a disabled worker so regression tests never send real email.

Local mode uses the same email, database migration, notification, reminder and auth
code as production. `NODE_ENV=development`, HTTP cookies and localhost URLs are
intentional for local HTTP. Running with `NODE_ENV=production` is not necessary to
exercise real email delivery.

## Run locally

In `tally_api`:

```sh
pnpm env:check
pnpm db:up
pnpm db:setup
pnpm dev
```

If Docker reports permission denied, run the following in your own terminal (sudo
may ask for your system password), then continue with `pnpm db:setup`:

```sh
sudo docker compose up -d postgres
```

The agent cannot enter your sudo password. Do not point the local profile to the
production database to work around Docker permissions.

The Docker database listens on the `.env` `POSTGRES_PORT` (currently 5432).
`DATABASE_URL` must use the same host port, database and credentials. `.env.test`
uses the same PostgreSQL server but a separate `tally_test` database. If the Docker
volume was created before the test-database init script existed, create the test
database once with:

```sh
sudo docker compose exec postgres sh -c 'createdb -U "$POSTGRES_USER" tally_test'
```

Do not recreate/delete an existing database volume just to create this database.

In `tally_web`:

```sh
pnpm dev
```

Open `http://localhost:3000`. The frontend's local `.env` points to
`http://localhost:5000/api/v1`; production public URLs come from `.env.production`
or Vercel settings. Never put Resend keys, database credentials or JWT secrets in
frontend files or any `NEXT_PUBLIC_` variable.

## Why the two additional variables exist

| Variable                           | Role                                                    | Required for sending?                                                         |
| ---------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `EMAIL_PROVIDER=resend`            | Chooses the delivery provider                           | Yes                                                                           |
| `EMAIL_API_KEY`                    | Authenticates outbound API calls                        | Yes                                                                           |
| `EMAIL_FROM`                       | Sender address                                          | Yes                                                                           |
| `NOTIFICATION_WORKER_ENABLED=true` | Processes queued alert emails and scheduled reminders   | Yes for reminders/queued alerts; immediate verification/reset does not use it |
| `RESEND_WEBHOOK_SECRET`            | Verifies delivery/bounce callbacks arriving from Resend | No; leave blank until a webhook is configured                                 |

The worker flag defaults to true, so it technically need not be present, but it is
explicit in each profile to make behavior clear. The webhook secret is a different
credential (`whsec_...`), not another email API key (`re_...`). A local webhook must
use its own endpoint secret, not the production endpoint's secret.

## Email from localhost

Resend receives outbound HTTPS requests from the local API. A public tunnel is
**not needed to send** verification, reset or alert emails. Links in local emails
point to `http://localhost:3000`, so open them on the machine running the frontend.

The existing `onboarding@resend.dev` sender is a test sender. It can send to the
email address associated with your Resend account. For other recipients, verify a
domain you own in Resend and set `EMAIL_FROM` to an address on that domain in both
API profiles and Render. Resend applies the same test-sender recipient restriction even when the application runs in production mode.

To receive local delivery events, expose port 5000 using an HTTPS tunnel and add
`https://YOUR-TUNNEL/api/v1/webhooks/resend` as a **separate** Resend webhook.
Subscribe to email events, copy that endpoint's signing secret into local
`RESEND_WEBHOOK_SECRET`, and restart the local API. Outgoing email works while
this value is empty; delivery event storage does not.

Enable Email notifications in Settings for optional interview, status and
follow-up emails. Password/social-account security alerts do not depend on that
preference. Migrations must be applied before the worker can use notification tables.

## OAuth callbacks

Register `http://localhost:5000/api/v1/auth/google/callback` and
`http://localhost:5000/api/v1/auth/github/callback` in the local provider apps.
Keep the production callback URLs registered for production credentials. GitHub
OAuth apps have a single callback URL, so a separate local GitHub OAuth app may
be needed; put its credentials only in the local API `.env`.

## Environment selection

| Process NODE_ENV  | Backend file                                                      |
| ----------------- | ----------------------------------------------------------------- |
| unset/development | `.env`                                                            |
| test              | `.env.test`                                                       |
| production        | `.env.production` if present; otherwise platform environment only |

Injected variables always win. The Prisma CLI uses the same selection as the API.
Neither production nor tests fall back to the development file. For a production
migration from your own machine, explicitly choose the production profile:

```sh
NODE_ENV=production pnpm env:check
NODE_ENV=production pnpm db:deploy
```

Do not run production migration commands until the intended database is confirmed.
On Render, configure `NODE_ENV=production` and the production variables in its
Environment settings; editing a local file does not update Render. See
[email-notifications.md](email-notifications.md) for the deployment checklist.

Example files contain no usable credentials. The `env:check` commands print only
configuration status, public URLs and database host/name, not secrets. They validate
configuration, not DNS, credential permissions, provider delivery or database connectivity.

For concise answers about test databases, migration URLs and Resend setup, see [env-setup-checklist.md](env-setup-checklist.md).
