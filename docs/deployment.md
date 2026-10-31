# Deployment Guide

Set `PRISMA_GENERATE_DATABASE_URL` to a syntactically valid, non-production
PostgreSQL URL before building. It is used only to generate Prisma's client;
the build does not connect to it. This keeps runtime and migration credentials
out of image layers and build history.

Build the runtime image with `docker build --target runtime -t tally-api --build-arg PRISMA_GENERATE_DATABASE_URL="$PRISMA_GENERATE_DATABASE_URL" .`.
Run the migration image once per release, before starting the runtime image:

```sh
docker compose -f docker-compose.deploy.yml --profile migration run --rm migrate
docker compose -f docker-compose.deploy.yml up -d api
```

Provide production values through an untracked `.env.production` file or the
deployment platform’s secret manager. The Compose file treats the local file
as optional so platform-injected environment values also work; deployment must
still supply every required production variable. The runtime process only needs
`DATABASE_URL`; Prisma migration commands use `MIGRATION_DATABASE_URL` when it
is set, allowing a separate privileged migration role.

The runtime container exposes port `5000` and its health check calls
`/api/v1/health`. Do not embed connection strings, OAuth credentials, or token
secrets in images, Compose files, or source control.

## Registration fails after the account is created

If registration returns `EMAIL_DELIVERY_FAILED`, inspect the `email_delivery_failed`
log event. Account creation happens before delivery, so an unverified account may
already exist. After fixing delivery, repeat signup with the same email/password
or use `/api/v1/auth/resend-verification`. Retrying signup never replaces an
existing account's password or profile.

For Resend, set `EMAIL_API_KEY` to a sending key and `EMAIL_FROM` to an address
on a verified sending domain. The `onboarding@resend.dev` test sender restricts
recipients and is unsuitable for public signup. Configure the verified sender in
Render's environment and redeploy; changing a local `.env.production` does not
change Render's environment. Do not bypass email verification to recover an account.

See [email and notification deployment](email-notifications.md) for the notification migration, worker, verified sender and Resend webhook setup.
