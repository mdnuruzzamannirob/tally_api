# Isolated recruiter demo

The demo profile is opt-in and separate from normal accounts. `DEMO_MODE=false`
is the default. Do not enable it on a database containing real user information;
provision a dedicated PostgreSQL database and API service.

## Visitor behavior

The frontend login page offers **Try demo** when built with
`NEXT_PUBLIC_DEMO_MODE=true`. One click creates a new verified fictional identity,
eight applications across all seven statuses (one archived), two tags, eight
notes, a completed phone screen and a future technical interview. Dates are
relative to workspace creation. No shared password is published or returned.

Visitors can edit their own applications, notes, interviews and tags, import a
backup, export JSON/CSV, and restore their own sample data. The banner identifies
the demo and asks visitors to use fictional information. Profile/security tabs
and the email preference switch are unavailable. Normal API authorization still
checks resource ownership.

Account registration, credential login, password/recovery/verification actions,
OAuth and profile identity changes are blocked by the demo boundary. Email
webhooks are unmounted. The mail factory returns a transport that throws before
any delivery, including when old provider credentials happen to be present.
Environment validation requires the notification worker off and the console
provider selection. Normal production delivery and OAuth requirements remain
unchanged outside the demo profile. HTTPS cookie and signing-secret requirements
apply to production demos too.

## Deployment configuration

1. Create a dedicated disposable PostgreSQL database and API service. Keep them
   separate from the normal application's database, secrets and backups.
2. Configure the keys in [the demo environment example](../.env.demo.example)
   through the host's secret manager. Generate a fresh secret with
   `openssl rand -hex 32`; do not commit it. Leave all live mail and OAuth keys
   unset. `API_BASE_URL` is the API origin; `WEB_APP_URL` is the exact frontend
   origin, including HTTPS and without a path.
3. Run the migration release task `pnpm db:deploy` with this dedicated database,
   then start the compiled API or its runtime image. Do not run the development
   CLI seed in production. The visitor endpoint creates its own fixture.
4. Build the frontend with the three values from
   [its demo example](../../tally_web/.env.demo.example). Vercel needs these in
   the selected deployment environment **before building**. Docker accepts
   `NEXT_PUBLIC_DEMO_MODE` along with the existing API/app build arguments.
5. Verify `/api/v1/health` returns 200, the frontend is public, TLS is valid,
   credentialed CORS allows only the intended frontend, and the browser receives
   the HttpOnly `tally_rt` cookie with Secure and SameSite=None. Exercise refresh
   and logout in a browser; a health response alone does not verify cookies.
6. Verify two independent browser contexts, reset, export and mobile layout on
   the deployed URLs. OAuth callback testing is intentionally excluded from this
   demo; normal OAuth remains a separate provider acceptance gate.

Cross-site cookies may be blocked by browser privacy settings. Prefer frontend
and API subdomains of the same owned site for a public deployment, and verify the
actual browser policy. A same-machine HTTP check does not establish this gate.

## Limits, reset and recovery

- A workspace becomes inaccessible after 24 hours. Its rows are deleted on the
  next successful creation attempt, not by an exact-time deletion scheduler.
- Creation is limited to ten requests per IP per hour. Production rate buckets
  use PostgreSQL. The demo has at most 100 workspace identities; a transaction
  advisory lock serializes capacity checks across API processes. Full capacity
  returns 503 without leaving partial fixtures.
- **Reset sample data** asks for confirmation, then transactionally replaces only
  that visitor's applications, notes, interviews and tags. It does not reset the
  lifetime or change other visitors. Export before resetting if a backup matters.
- Reset requests use a per-user row lock. Creation/reset require the configured
  Origin and `X-Requested-With: XMLHttpRequest`. Reset also requires a live bearer
  session. Reset failures roll back, rather than leave half a fixture.
- If a visitor loses their session, start another workspace; no recovery email is
  sent. Signing out does not immediately delete the workspace. If capacity is
  full, show the recording/screenshots until expired workspaces can be removed.
- If the demo database is damaged, stop the demo API, provision a fresh **demo**
  database, apply migrations and restart. Existing demo sessions will fail and
  visitors can start again. Never point this recovery procedure at real data.
- For an unavailable API, inspect host startup/migration/DB connectivity logs.
  Rebuild the web app if its API URL changed. Check health and the browser flow
  again before sharing a recruiter link. Do not label a 503 as a measured cold
  start; first recover the service and measure it separately.

This is a bounded portfolio demo, not a production multi-tenant sandbox service.
Imported data remains user-provided; the banner cannot prevent someone typing
personal information. Retention is limited and live delivery is disabled.

## Repeatable local verification

From the parent Tally workspace, use the retained verification runner:

```bash
TALLY_VERIFY_OUTPUT="$PWD/artifacts/phase-e-2026-11-28" \
  python3 artifacts/phase-b-2026-11-28/run-verification.py --demo
```

It requires the existing Node/pnpm dependencies, Docker PostgreSQL 16 and the
installed Playwright browser. It creates a separate temporary database, migrates
it, runs the normal API checks, builds the demo frontend, runs the demo against
the compiled API, records screenshots/video/captions and tears down its resources.
It does not seed or modify the existing development database. Local API cookies
use the test profile on HTTP; public HTTPS acceptance remains a separate step.

See [showcase walkthrough](../../tally_web/docs/demo-walkthrough.md) for visitor
instructions and [canonical evidence](../../tally_web/PROJECT_METRICS_INVENTORY.md)
for the actual checks and publication status.
