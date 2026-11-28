# Tally API

Tally's TypeScript/Express API manages job applications, status history, notes,
interviews, tags, dashboard summaries and portable backups. Prisma/PostgreSQL
provide relational persistence; the API owns authentication, validation,
authorization and notification processing.

**Stack:** Express 5, TypeScript, Prisma 7, PostgreSQL 16, JWT, Vitest/Supertest
and multi-stage Docker packaging.

Source: [API repository](https://github.com/mdnuruzzamannirob/tally_api) ·
[Next.js frontend](https://github.com/mdnuruzzamannirob/tally).
In the paired workspace, see the [case study](../tally_web/docs/career/case-study.md),
[architecture](../tally_web/docs/career/architecture.md) and
[evidence register](../tally_web/docs/career/achievements.md).

## What the API demonstrates

- Server-derived identity and owner-scoped application/child-record operations.
- Hashed opaque refresh tokens, atomic rotation, absolute session expiry and
  strict reuse detection; coordinated browser behavior lives in the frontend.
- Validated JSON replacement in one database transaction, with failure rollback;
  CSV exports cover applications and neutralize formula-like values.
- Database-backed reminder claims, leases, retries and relevance checks inside
  the API process; no separate broker is required by the current implementation.
- An isolated fictional demo profile with per-visitor workspaces, guarded reset,
  expiry, bounded creation and disabled external delivery.
- One route manifest generating OpenAPI and Postman artifacts.

## Run locally

Use Node 24, pnpm 9.15.0 and a local PostgreSQL 16 instance. Docker is optional
when PostgreSQL is already available. In this repository:

```sh
cp .env.example .env
pnpm install --frozen-lockfile
```

Edit `.env` before starting the application:

| Key                            | Local configuration                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                 | A local development database you control; never a production/test target by accident                             |
| `ACCESS_TOKEN_SECRET`          | A fresh local secret; `openssl rand -hex 32` can generate one                                                    |
| `EMAIL_PROVIDER`               | Set to `console` for local development; the example defaults to Brevo and requires credentials if left unchanged |
| `EMAIL_FROM`                   | Add `no-reply@tally.local` for the console transport                                                             |
| `NOTIFICATION_WORKER_ENABLED`  | Set `false` when background reminder processing is not needed                                                    |
| `API_BASE_URL` / `WEB_APP_URL` | Defaults: `http://localhost:5000` / `http://localhost:3000`                                                      |

If using the supplied local PostgreSQL service, `pnpm db:up` starts it. Check that
the selected database and local port are appropriate, then:

```sh
pnpm env:check
pnpm db:setup
pnpm dev
```

`db:setup` generates the Prisma client and applies committed migrations. The
development server exposes health at `http://localhost:5000/api/v1/health`,
Swagger UI at `/api/v1/docs/`, and the contract at `/api/v1/openapi.json`.
Local console mail prints development messages, including verification links;
normal account login still requires verification. No shared seed password exists.

Environment loading selects `.env`, `.env.test` or `.env.production` by profile;
injected environment values take precedence. Real transports require their own
credentials. The [production guide](docs/deployment.md) covers secret injection,
build-time Prisma generation, migration release tasks and runtime images.

## Verify relevant changes

| Command                        | Purpose                                                    |
| ------------------------------ | ---------------------------------------------------------- |
| `pnpm lint` / `pnpm typecheck` | Static checks                                              |
| `pnpm test:unit`               | Unit and health cases                                      |
| `pnpm test:integration`        | Serial database-backed cases; requires `TEST_DATABASE_URL` |
| `pnpm contracts:generate`      | Generate OpenAPI and Postman from the route manifest       |
| `pnpm contracts:validate`      | Contract validation                                        |
| `pnpm format` / `pnpm build`   | Formatting check / compiled API                            |

Integration helpers delete fixture records. Use the
[dedicated test-database procedure](docs/testing.md), not a development or
production database. Select checks based on the change; documentation-only edits
need document validation rather than repeated runtime or benchmark runs.

The retained Phase E result passed 95 unit/health and 62 serial integration
cases. They overlap on five health cases, giving **152 unique API tests**.
Import rollback, ownership denial, session behavior, reminders and demo lifecycle
failures have retained evidence. See the paired workspace's
[metrics inventory](../tally_web/PROJECT_METRICS_INVENTORY.md); these results were
not rerun to write this README.

## Normal production and optional demo

The production service keeps normal signup/login, OAuth and configured email
behavior, with `DEMO_MODE=false` (the default). Recruiters get the recording and
their own normal-account testing instructions in the
[frontend README](https://github.com/mdnuruzzamannirob/tally#for-recruiters).

For an optional isolated profile, follow [demo operations](docs/demo.md) and [the demo template](.env.demo.example)
for a dedicated disposable database/service. Demo mode is off by default; it
blocks account security/OAuth actions, turns off the worker and substitutes a
fail-closed mail transport. Production demos still require secure cookies and a
strong signing secret.

On 29 November 2026, the paused Supabase project was resumed and API health
returned 200. All six existing migrations were already applied. Hosted API CI
passed, and the live normal-account GitHub/session/data workflow was checked.
Google OAuth, email/password signup delivery and production backup/PITR policy
remain unverified by that check. Reminder delivery is at-least-once. The
[recovery runbook](docs/recovery.md) distinguishes local restore rehearsal from
production recovery guarantees.

The project is maintained under `mdnuruzzamannirob`, with AI-assisted implementation
and review. See the [documentation index](docs/README.md) for maintained runbooks.
Paired-workspace links need the sibling frontend checkout; they are documentation
references, not runtime dependencies.
