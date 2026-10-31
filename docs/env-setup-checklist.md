# Env setup: simple decisions and checklist

## Database

Local development and automated tests can use the same PostgreSQL server/container,
port and user. They must use different databases:

| Profile                               | Database                             | Purpose                                    |
| ------------------------------------- | ------------------------------------ | ------------------------------------------ |
| Local `.env`                          | `tally`                              | Your development accounts and applications |
| Test `.env.test`                      | `tally_test`                         | Data created/deleted by automated tests    |
| Production `.env.production` / Render | Existing managed production database | Hosted user data                           |

`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and `POSTGRES_PORT` configure
the local Docker PostgreSQL service. They do not connect the API by themselves;
`DATABASE_URL` does that. Production uses an already provisioned managed server,
so these Docker initialization variables are not needed there. Tests reuse the
local PostgreSQL server through their own URL; they do not need another set of
Docker initialization variables.

All databases need the same application schema migrations. A separate
`MIGRATION_DATABASE_URL` is not required: the CLI falls back to `DATABASE_URL`.
It is an optional connection for a different migration role/direct connection to
the **same target database**, not a separate database for storing migrations.

## Email variables

- `EMAIL_PROVIDER=resend`: sends real mail in local development and production.
- `EMAIL_API_KEY`: a Resend sending key. Prefer separate local/production keys; existing keys are retained until replaced.
- `EMAIL_FROM`: a sender address, not the recipient. Local currently uses `onboarding@resend.dev`; Resend restricts this test sender to your account's allowed recipient.
- `EMAIL_API_BASE_URL`: not needed. The adapter defaults to `https://api.resend.com/emails`. This optional override is the complete send endpoint, not just the hostname.
- `RESEND_WEBHOOK_SECRET`: not needed to send email. It is the `whsec_...` secret for a particular Resend webhook endpoint, used to store delivery/bounce reports.
- `.env.test`: uses `EMAIL_PROVIDER=console`, so its `EMAIL_FROM=no-reply@tally.test` does not send real mail. Use the normal local `.env` to manually test real inbox delivery.

Empty optional overrides and unused SMTP/Mailgun settings have been removed from
the actual env files. Complete optional settings remain in the examples. Copy an
optional line into an actual file only when configuring that feature. The worker
flag remains explicit: local/production true, tests false.

## Your local setup

From `tally_api`:

```sh
sudo docker compose up -d postgres
pnpm env:check
pnpm db:setup
NODE_ENV=test pnpm db:deploy
pnpm test:all
pnpm dev
```

The test database is created by the Docker initialization script for a new volume.
If an existing volume does not contain `tally_test`, create only that database once:

```sh
sudo docker compose exec postgres sh -c 'createdb -U "$POSTGRES_USER" tally_test'
```

Do not delete the volume to create the test database. All test migration commands
above select `.env.test`; normal `pnpm db:setup` selects the local `.env`.

In a second terminal, from `tally_web`, run `pnpm dev` and open
`http://localhost:3000`. For real email testing, sign up with the address associated
with your Resend account while using the test sender. Enable optional Email
notifications in Settings when testing interview/status/follow-up messages.

## Your production email setup

1. Open Resend → Domains → Add Domain. Use a domain/subdomain you own and can manage DNS for. Shared Vercel/Render hostnames are not a domain you control for this purpose.
2. Add the exact DNS records Resend displays in your domain's DNS manager. Wait for Resend to show the sending domain as verified.
3. Choose a sender on that exact verified domain. For example, if `mail.yourdomain.com` is verified, use `noreply@mail.yourdomain.com`. This is an example, not a domain already configured for this project. A receiving mailbox is not required solely to send from a verified address.
4. In Resend → API Keys, create a key with sending permission scoped to the verified domain, if desired. Put the production key in Render's `EMAIL_API_KEY`.
5. Put the chosen verified sender in Render's `EMAIL_FROM` and your local `.env.production`. You may also use it in local `.env`; a separate sender domain for localhost is not required.
6. Keep `EMAIL_PROVIDER=resend` and `NOTIFICATION_WORKER_ENABLED=true` in Render. Ensure `NODE_ENV=production` and the correct public API/frontend URLs are set.
7. Run production migrations before starting the new release, then redeploy. Editing a local env file does not change Render's environment. From your machine, explicit production commands are `pnpm env:check:production` and `NODE_ENV=production pnpm db:deploy`; confirm the intended target database first.

The existing `onboarding@resend.dev` sender permits account-owner testing, subject to Resend restrictions. Other recipients require a verified sending domain. No key, domain or webhook secret was invented in the actual files.

## Optional delivery tracking

1. Deploy the backend webhook endpoint first.
2. In Resend → Webhooks, create an endpoint for `https://tally-api-stag.onrender.com/api/v1/webhooks/resend`.
3. Subscribe to email events such as `email.sent`, `email.delivered`, `email.bounced`, `email.failed`, `email.delivery_delayed`, `email.complained` and `email.suppressed`.
4. Open that webhook's details and copy its signing secret (`whsec_...`). Add `RESEND_WEBHOOK_SECRET=whsec_...` to Render and your local production profile, then redeploy.
5. For local callback testing, expose local API port 5000 with an HTTPS tunnel, create a separate Resend webhook for `https://YOUR-TUNNEL/api/v1/webhooks/resend`, and put that endpoint's own secret in local `.env`. Restart the local API.

A local tunnel is only for receiving callbacks. Sending mail from localhost needs
no tunnel or webhook secret. Keep secrets on the backend, not in `NEXT_PUBLIC_` variables.

References: [Resend sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain),
[verified domains](https://resend.com/docs/dashboard/domains/introduction),
[API keys](https://resend.com/docs/dashboard/api-keys/introduction),
[webhook signing secret](https://resend.com/docs/webhooks/verify-webhooks-requests).
