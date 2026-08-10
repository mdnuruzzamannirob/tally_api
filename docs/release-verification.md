# Release Verification

This runbook verifies an already-configured local, staging, or production API
without putting credentials in source control. Complete it for each release;
the deployment owner records the environment, release identifier, and result in
the release ticket or deployment system.

## Automated checks

Run these before promoting a build. Database integration tests require a
dedicated, disposable test database.

```sh
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm lint
pnpm typecheck
pnpm test:all
pnpm build
```

After deploying to the target environment, run the smoke test with only the
target's public API URL and allowed web origin supplied by the shell or secret
manager:

```sh
pnpm test:smoke
```

The smoke test calls `/api/v1/health` and verifies database connectivity, the
response envelope, request-ID propagation, CORS, and key security headers. It
does not print environment values, response bodies, tokens, or credentials.

## Release-owner checklist

- [ ] CI passed for the release commit.
- [ ] A clean migration was applied to preview/staging before production.
- [ ] Runtime receives only `DATABASE_URL`; the migration job receives the
      separate `MIGRATION_DATABASE_URL`.
- [ ] Production environment validation passes, including secure cookies and a
      non-console email provider.
- [ ] The deployed health smoke test passes over HTTPS.
- [ ] Google and GitHub provider dashboards contain the exact deployed callback
      URLs and their credentials are stored only in the deployment secret
      manager.
- [ ] A verification and password-reset email was delivered from the configured
      transactional provider; logs contain no token or message body.
- [ ] Credentialed CORS permits only the exact deployed web origin; refresh and
      logout requests succeed from that origin and fail from an unapproved one.
- [ ] Provider logs show request IDs and redaction is enabled; no credentials,
      cookies, tokens, email bodies, or database URLs appear in a sampled log
      window.
- [ ] Health monitoring checks `/api/v1/health` at least every five minutes and
      alerts after repeated failures.
- [ ] Managed database backups, retention, and restore access are confirmed.
- [ ] The previous backend image/release is available for rollback. Any risky
      migration has a tested forward-fix or restore plan.

## Frontend E2E handoff

Run frontend E2E tests against a dedicated preview environment and test
accounts, never production data. Configure the frontend API URL to that API and
configure `WEB_APP_URL` on the API to the exact preview origin. Cover the
critical flow: register, verify email, sign in, create/edit/status-change an
application, add a note and interview, search/filter, export/import, and sign
out. OAuth E2E must use the stable preview callback URLs registered with each
provider.

## Rollback

For application-only regressions, roll back to the previous backend release,
then rerun `pnpm test:smoke`. Do not attempt to reverse a destructive migration
in place. Use the documented forward-fix migration or restore a verified
database backup, then validate the health endpoint and critical user flows.

See [deployment.md](deployment.md) for image/migration commands and
[operations-spec.md](operations-spec.md) for monitoring, backups, and recovery.
