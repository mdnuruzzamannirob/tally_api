# Operations Specification

## Job Application Tracker

**Version:** 1.0
**Status:** Final for MVP
**Related Documents:**

- Product Requirements Document v1.1
- UI/UX Specification v1.1
- Frontend Specification v1.0
- Backend Specification v1.0
- Database Specification v1.0

---

## 1. Purpose and Scope

This document defines how Job Application Tracker will be operated, deployed, tested, monitored, and maintained.

It covers:

- Environments
- Local development setup
- Docker usage
- Environment variables
- Secrets management
- CI/CD pipeline
- Deployment strategy
- Database migrations
- Health checks
- Logging
- Monitoring
- Backup and recovery
- Rollback strategy
- Security operations
- Release checklist
- Troubleshooting

The operations model is designed to be simple enough for a side project but professional enough to demonstrate strong full-stack engineering practices.

---

## 2. Operations Goals

1. Developers can run the full project locally with minimal setup.
2. All environments use consistent configuration.
3. Database migrations are repeatable and safe.
4. Deployments are automated where possible.
5. Production issues can be detected quickly.
6. Rollback is possible for frontend and backend.
7. Secrets are never committed to source control.
8. The system remains secure and observable without excessive complexity.

---

## 3. Environments

The project will use the following environments:

| Environment | Purpose              | Database                                          |
| ----------- | -------------------- | ------------------------------------------------- |
| Local       | Development          | Docker PostgreSQL                                 |
| Preview     | Pull request testing | Preview/shared PostgreSQL branch or shared dev DB |
| Production  | Live application     | Managed production PostgreSQL                     |

Preview rules:

- A preview frontend must never point at the production API or database.
- Credentialed CORS uses an exact preview origin. If pull-request URLs are
  dynamic, use a stable preview alias or provision a matching preview backend;
  do not enable an unrestricted `*.vercel.app` credentialed origin.
- OAuth testing requires provider callback URLs for the stable preview backend.

---

## 4. Recommended Production Infrastructure

Final recommended production setup:

```txt
Frontend
  -> Vercel
      Next.js PWA

Backend
  -> Render
      Express TypeScript API

Database
  -> Neon PostgreSQL
      Managed PostgreSQL
```

Neon is the production default. Supabase PostgreSQL or Render PostgreSQL may
be substituted as equivalent managed PostgreSQL providers without changing the
application architecture.

---

## 5. Repository Structure

Recommended polyrepo structure:

```txt
api/                               # Express + TypeScript + Prisma API
├── src/
├── prisma/
├── tests/
├── docker-compose.yml
├── package.json
├── .env.example
└── .github/workflows/ci.yml

web/                               # Next.js frontend
├── src/
├── public/
├── tests/
├── package.json
├── .env.example
└── .github/workflows/ci.yml
```

Package manager:

```txt
pnpm
```

Rules:

- Each repository has its own dependency lockfile, CI pipeline, deployment, and version history.
- API and web communicate only through the versioned HTTP contract.
- `contracts/openapi.json` is the versioned OpenAPI 3.1 release artifact. The
  API serves it at `/api/v1/openapi.json` and Swagger UI at `/api/v1/docs`; the
  web repository pins and validates the released artifact before consuming new
  endpoints.
- A shared package, if later needed, is separately versioned and published; it is not a workspace dependency.

---

## 6. Local Development Setup

## 6.1 Prerequisites

Required:

```txt
Node.js LTS
pnpm
Docker
Git
```

Recommended Node version:

```txt
Node 20.9+ (use a currently supported LTS release)
```

---

## 6.2 Initial Setup

```bash
cd api

pnpm install

cp .env.example .env

docker compose up -d

pnpm db:migrate
pnpm db:seed

pnpm dev
```

Run `web/` separately. Its `.env` must set `NEXT_PUBLIC_API_URL`
to the running API URL.

Expected local URLs:

```txt
Frontend: http://localhost:3000
Backend:  http://localhost:4000
Database: postgresql://tally:tally@localhost:5433/tally
```

---

## 6.3 API Repository Scripts

Recommended root `package.json` scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.build.json",
    "lint": "eslint src tests",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio"
  }
}
```

---

## 7. Docker Usage

Docker is required for local PostgreSQL.

### `docker-compose.yml`

```yaml
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: tally
      POSTGRES_PASSWORD: tally
      POSTGRES_DB: tally
    ports:
      - "5432:5432"
    volumes:
      - tally_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tally -d tally"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  tally_pgdata:
```

Rules:

- Local database data should persist using Docker volume.
- Do not use production credentials locally.
- Docker is not required for production deployment if using managed providers.

---

## 8. Environment Configuration

Environment configuration must be separated by environment.

Never commit real secrets.

---

## 8.1 Frontend Environment Variables

File:

```txt
web/.env
```

Required variables:

```txt
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Production example:

```txt
NEXT_PUBLIC_API_URL=https://api.tally.example.com/api/v1
NEXT_PUBLIC_APP_URL=https://tally.example.com
```

Rules:

- Only public variables may use `NEXT_PUBLIC_`.
- No secrets may be exposed to frontend.
- API URL must be configurable per deployment.

---

## 8.2 Backend Environment Variables

File:

```txt
api/.env
```

Required variables:

```txt
NODE_ENV=development
PORT=4000

DATABASE_URL=postgresql://tally:tally@localhost:5433/tally
MIGRATION_DATABASE_URL=

WEB_APP_URL=http://localhost:3000

ACCESS_TOKEN_SECRET=change_me

ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

EMAIL_PROVIDER=console
EMAIL_API_KEY=
EMAIL_FROM=no-reply@tally.local

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

COOKIE_SECURE=false
COOKIE_SAME_SITE=lax

LOG_LEVEL=debug
```

Production example:

```txt
NODE_ENV=production
PORT=4000

DATABASE_URL=postgresql://...
MIGRATION_DATABASE_URL=postgresql://...privileged-migration-role...

WEB_APP_URL=https://tally.example.com

ACCESS_TOKEN_SECRET=...

ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=...
EMAIL_FROM=no-reply@tally.example.com

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

COOKIE_SECURE=true
COOKIE_SAME_SITE=none

LOG_LEVEL=info
```

---

## 8.3 Backend Environment Validation

Backend must validate environment variables at startup.

Required for production:

```txt
DATABASE_URL
WEB_APP_URL
ACCESS_TOKEN_SECRET
EMAIL_PROVIDER
EMAIL_FROM
```

Production rejects `EMAIL_PROVIDER=console` and requires the selected
provider's credentials (for example `EMAIL_API_KEY`).

The separate production migration job requires `MIGRATION_DATABASE_URL`; the
runtime backend validator must not require or receive that privileged secret.

Because Google and GitHub OAuth are MVP Must Haves, production requires:

```txt
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
```

If required variables are missing, the backend must fail to start.

---

## 9. Secrets Management

## 9.1 Rules

- Do not commit `.env` files.
- Add `.env` to `.gitignore`.
- Store secrets only in:
  - Local `.env`
  - Vercel environment variables
  - Render environment variables
  - Neon database credentials
  - Provider dashboards
- Rotate secrets if accidentally exposed.
- Use separate secrets per environment.

---

## 9.2 Generating Secrets

Use strong random secrets.

Example:

```bash
openssl rand -hex 32
```

Generate a strong value for:

```txt
ACCESS_TOKEN_SECRET
```

---

## 9.3 Secret Classification

| Secret              | Owner             | Sensitivity |
| ------------------- | ----------------- | ----------- |
| Database URL        | Database provider | High        |
| Migration DB URL    | Database provider | High        |
| Access token secret | Backend           | High        |
| Email API key       | Email provider    | High        |
| Google OAuth secret | Google Cloud      | High        |
| GitHub OAuth secret | GitHub            | High        |
| Public API URL      | Frontend          | Low         |

---

## 10. Branching Strategy

Use a simple Git flow:

```txt
main
  -> production branch

feature/*
  -> new features

fix/*
  -> bug fixes

chore/*
  -> maintenance
```

Rules:

- Pull requests required for `main`.
- CI must pass before merge.
- Deployments happen from `main`.
- Preview deployments should be generated for pull requests where possible.

---

## 11. CI/CD Specification

Use GitHub Actions.

Required pipeline checks:

1. Install dependencies
2. Lint
3. Typecheck
4. OpenAPI validation and contract tests
5. Unit tests
6. API integration tests
7. Build frontend
8. Build backend
9. Release-candidate E2E tests (optional on each pull request)

---

## 11.1 API Repository Workflow

```yaml
name: CI

on:
  push:
    branches:
      - main
  pull_request:

jobs:
  quality:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: tally
          POSTGRES_PASSWORD: tally
          POSTGRES_DB: tally_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U tally"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      DATABASE_URL: postgresql://tally:tally@localhost:5432/tally_test
      ACCESS_TOKEN_SECRET: ci_test_access_secret_at_least_32_bytes
      WEB_APP_URL: http://localhost:3000

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Prisma generate
        run: pnpm db:generate

      - name: Prisma migrate
        run: pnpm db:deploy

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Unit tests
        run: pnpm test

      - name: Build
        run: pnpm build
```

The web repository has its own workflow. It runs install, lint, typecheck,
unit/component tests, build, and Playwright critical flows; it does not run API
or database commands. The API workflow additionally runs Prisma validation and
generation, PostgreSQL-backed integration tests, container build, and release
smoke checks.

---

## 11.2 E2E Tests

Critical E2E tests are required before production release. Running them on
every pull request is optional; they may run in a dedicated release workflow.

Critical flows:

1. Register
2. Verify email
3. Login
4. Create application
5. Edit application
6. Change status
7. Add note
8. Add interview
9. Search/filter
10. Logout

E2E may run:

- On pull request
- Before production deployment
- Manually when needed

---

## 12. Deployment Strategy

## 12.1 Deployment Flow

```txt
Merge to main
  -> GitHub Actions passes
  -> Render pre-deploy job runs Prisma migrations
  -> Render deploys/starts backend with runtime database credentials
  -> Health check passes
  -> Vercel promotes the frontend deployment
  -> Production smoke test passes
```

---

## 12.2 Frontend Deployment

Provider:

```txt
Vercel
```

Repository root:

```txt
web
```

Framework:

```txt
Next.js
```

Build command:

```txt
pnpm build
```

Environment variables:

```txt
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_APP_URL
```

Deployment rules:

- Production deployment from `main`.
- Preview deployment for pull requests.
- HTTPS automatically enabled.
- PWA must be tested after deployment.
- Service worker should be active in production.

---

## 12.3 Backend Deployment

Provider:

```txt
Render
```

Repository root:

```txt
api
```

Build command:

```txt
pnpm install --frozen-lockfile && pnpm build
```

Start command:

```txt
pnpm start
```

Pre-deploy command, using `MIGRATION_DATABASE_URL`:

```txt
pnpm db:deploy
```

Environment variables:

```txt
NODE_ENV
PORT
DATABASE_URL
MIGRATION_DATABASE_URL
WEB_APP_URL
ACCESS_TOKEN_SECRET
ACCESS_TOKEN_EXPIRES_IN
REFRESH_TOKEN_EXPIRES_IN
EMAIL_PROVIDER
EMAIL_API_KEY
EMAIL_FROM
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
COOKIE_SECURE
COOKIE_SAME_SITE
LOG_LEVEL
```

Deployment rules:

- A separate pre-deploy job must run database migrations before the new backend
  starts; the runtime process must use `DATABASE_URL`, not the migration role.
- Backend must expose health endpoint.
- Backend must shut down gracefully.
- Production logs must avoid sensitive data.

---

## 12.4 Database Deployment

Provider:

```txt
Neon PostgreSQL
```

Database operations:

| Action               | Tool                          |
| -------------------- | ----------------------------- |
| Schema definition    | Prisma schema                 |
| Local migration      | `prisma migrate dev`          |
| Production migration | `prisma migrate deploy`       |
| Database inspection  | Prisma Studio or Neon console |
| Backup               | Neon automated backups        |

Rules:

- Never manually edit production tables.
- Always deploy through migrations.
- Test migrations against preview database before production.
- Destructive migrations require manual review.

---

## 13. Database Migration Strategy

## 13.1 Local Development

```bash
pnpm db:migrate
```

Use when:

- Adding tables
- Adding columns
- Adding enums
- Adding indexes
- Modifying relations

---

## 13.2 Production Migration

Production migrations run during backend deployment:

```bash
prisma migrate deploy
```

Rules:

- `prisma migrate deploy` must be safe to invoke repeatedly; Prisma migration
  history, rather than hand-written rerun logic, prevents reapplying migrations.
- Migration must not require interactive input.
- Migration should be backward compatible where possible.
- Large migrations should be tested on staging/preview first.

---

## 13.3 Breaking Schema Changes

Use expand-and-contract pattern when possible.

Example:

```txt
1. Add new column
2. Deploy code that writes to both old and new column
3. Backfill data
4. Switch reads to new column
5. Remove old column later
```

Avoid:

```txt
Renaming required columns directly in one high-risk migration
Dropping tables without backup
Running irreversible production migrations without review
```

---

## 14. OAuth and Email Provider Setup

## 14.1 Google OAuth

Required configuration:

- Create Google OAuth credentials.
- Add authorized redirect URI:

```txt
https://api.tally.example.com/api/v1/auth/google/callback
```

Local redirect:

```txt
http://localhost:4000/api/v1/auth/google/callback
```

Store:

```txt
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

---

## 14.2 GitHub OAuth

Required configuration:

- Create GitHub OAuth App.
- Set callback URL:

```txt
https://api.tally.example.com/api/v1/auth/github/callback
```

Local callback:

```txt
http://localhost:4000/api/v1/auth/github/callback
```

Store:

```txt
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
```

---

## 14.3 Email Provider

Supported providers:

```txt
Resend
SendGrid
Mailgun
SMTP
```

Required configuration:

```txt
EMAIL_PROVIDER
EMAIL_API_KEY
EMAIL_FROM
```

Provider-specific configuration:

- Mailgun also requires `EMAIL_MAILGUN_DOMAIN`.
- SMTP requires `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`,
  `EMAIL_SMTP_PASSWORD`, and optionally `EMAIL_SMTP_SECURE`.
- `EMAIL_API_BASE_URL` may override the default provider API endpoint for a
  compatible proxy or regional endpoint.

Rules:

- Development may use console email provider.
- Production must use a real transactional email provider.
- Verification and reset links must use frontend URL.
- Email logs must not expose tokens in production.

---

## 15. Health Checks

## 15.1 Backend Health Check

Endpoint:

```txt
GET /api/v1/health
```

Expected response:

```json
{
  "success": true,
  "message": "Service is healthy.",
  "data": {
    "status": "ok",
    "database": "connected",
    "timestamp": "2026-01-01T00:00:00.000Z"
  },
  "meta": { "requestId": "request_id" }
}
```

Health check must:

- Check database connectivity.
- Return HTTP 200 when healthy.
- Return HTTP 503 when unhealthy.
- Not require authentication.
- Not expose secrets.

---

## 15.2 Frontend Smoke Check

After deployment, manually or automatically check:

```txt
/
/login
/register
/dashboard
/offline
```

Expected:

- Pages load.
- No critical console errors.
- PWA manifest loads.
- Service worker registers.
- API calls reach backend.

---

## 15.3 Uptime Monitoring

Minimum production monitoring:

- HTTP check against backend health endpoint.
- Check interval: 5 minutes.
- Alert if health check fails repeatedly.
- Confirm startup, shutdown, and unhandled-error events are visible in the
  structured log stream.

Optional:

- Frontend homepage check.
- Error tracking dashboard.
- API latency monitoring.

---

## 16. Logging Specification

## 16.1 Backend Logging

Use structured logs.

Recommended tool:

```txt
pino
```

Log levels:

```txt
debug
info
warn
error
```

Development:

```txt
LOG_LEVEL=debug
```

Production:

```txt
LOG_LEVEL=info
```

---

## 16.2 Required Logs

Log:

- Server startup
- Environment validation result
- Request method/path/status
- Response time
- Authentication failures
- OAuth callback failures
- Email send failures
- Database connection failures
- Unhandled errors

Do not log:

- Passwords
- Access tokens
- Refresh tokens
- Authorization headers
- Cookies
- Email bodies containing tokens
- OAuth secrets
- Database connection strings

---

## 16.3 Request ID

Every request should include a request ID.

Example header:

```txt
X-Request-ID
```

If header is missing, generate one.

Use request ID in logs and error responses where safe.

---

## 17. Monitoring Specification

For MVP, monitoring should remain simple.

## 17.1 Must Have

- Backend health endpoint
- Provider logs:
  - Vercel logs
  - Render logs
  - Neon database logs
- Deployment status
- Error logs
- HTTP uptime check

---

## 17.2 Optional but Recommended

- Sentry for error tracking
- UptimeRobot or Better Stack for health checks
- Vercel Analytics, if privacy-friendly
- Render metrics
- Neon usage alerts

---

## 17.3 Alert Conditions

Alert if:

- Health endpoint returns 503.
- Backend crash loop occurs.
- Database connection fails.
- Email provider fails repeatedly.
- OAuth callback errors spike.
- Production error rate increases significantly.

---

## 18. Backup and Recovery

## 18.1 Database Backup

Production PostgreSQL should have:

- Automated daily backups
- Point-in-time recovery if available
- Retention of at least 7 days

Neon should be configured to allow restore or branching for recovery.

---

## 18.2 Application-Level Backup

The application provides:

```txt
JSON export
CSV export
JSON import
```

These are user-facing backups but are not a replacement for database backups.

---

## 18.3 Recovery Scenarios

### Accidental data deletion

Recovery options:

1. Restore database from backup.
2. Ask user to import exported JSON if available.
3. Use preview/staging data if applicable.

### Bad migration

Recovery options:

1. Roll back backend deployment.
2. Restore database backup if data was damaged.
3. Apply forward-fix migration if safer.

### Environment secret leak

Recovery options:

1. Rotate secret immediately.
2. Redeploy backend.
3. Revoke affected tokens.
4. Review logs for suspicious activity.

---

## 19. Rollback Strategy

## 19.1 Frontend Rollback

Provider:

```txt
Vercel
```

Rollback method:

- Redeploy previous deployment from Vercel dashboard or CLI.

Expected time:

```txt
Under 5 minutes
```

---

## 19.2 Backend Rollback

Provider:

```txt
Render
```

Rollback method:

- Deploy previous Git commit.
- Ensure database schema is compatible with rolled-back code.

Important:

```txt
Database migrations are not always automatically reversible.
```

If migration was destructive, prefer:

```txt
Database restore + backend rollback
```

or:

```txt
Forward-fix deployment
```

---

## 19.3 Database Rollback

Database rollback depends on migration type.

Safe rollback:

```txt
Migration only added nullable columns or indexes.
```

Risky rollback:

```txt
Migration dropped columns, tables, or data.
```

Rules:

- Test risky migrations in preview first.
- Take backup before risky production migration.
- Avoid destructive migrations during MVP unless necessary.

---

## 20. Security Operations

## 20.1 Dependency Updates

Rules:

- Keep dependencies reasonably up to date.
- Review security advisories.
- Run:

```bash
pnpm audit
```

- Fix high/critical vulnerabilities promptly.

---

## 20.2 Access Control

Rules:

- Limit production provider access.
- Use strong passwords for provider accounts.
- Enable MFA where possible.
- Do not share production secrets publicly.

---

## 20.3 Runtime Security

Backend must enforce:

- HTTPS in production
- Secure cookies
- CORS origin restrictions
- Rate limiting
- Input validation
- Authentication and authorization
- Ownership checks

Frontend must enforce:

- No secrets in browser bundle
- Protected route redirection
- Secure auth token handling
- PWA served over HTTPS

---

## 21. PWA Operations

Production PWA requirements:

- Served over HTTPS.
- Manifest loads correctly.
- Icons load correctly.
- Service worker registers.
- Offline fallback page works.
- Update toast appears when new version is deployed.

After each production deployment:

1. Open app in browser.
2. Check manifest.
3. Check service worker.
4. Test offline fallback.
5. Test install prompt where supported.

---

## 22. Release Process

## 22.1 Pre-release Checklist

Before merging to `main`:

- Lint passes.
- Typecheck passes.
- Unit tests pass.
- Integration tests pass.
- Build passes.
- Database migration tested locally.
- No secrets in code.
- Environment variables documented.
- UI states tested:
  - loading
  - empty
  - error
  - success
  - offline
- Authentication flows tested:
  - register
  - verify email
  - login
  - forgot password
  - reset password
  - social login
- PWA tested locally.

---

## 22.2 Deployment Checklist

Before production deployment:

- Production database backup available.
- Migration reviewed.
- Backend environment variables configured.
- Frontend environment variables configured.
- OAuth callback URLs updated.
- Email provider configured.
- CORS origin correct.
- Cookie settings correct:

```txt
COOKIE_SECURE=true
COOKIE_SAME_SITE=none
```

- Allowed-origin validation is enabled for refresh and logout.

---

## 22.3 Post-deployment Checklist

After deployment:

- Backend health check passes.
- Frontend loads.
- Login works.
- Registration works.
- Email verification works.
- Social login works.
- Dashboard loads.
- Application CRUD works.
- PWA manifest loads.
- Service worker registers.
- Logs show no critical errors.
- No sensitive data in logs.

---

## 23. Troubleshooting Guide

## 23.1 Backend health check fails

Check:

1. Render service status.
2. Backend logs.
3. `DATABASE_URL`.
4. Database connectivity.
5. Migration status.
6. Environment validation errors.

---

## 23.2 Login fails

Check:

1. Backend logs.
2. CORS configuration.
3. Cookie settings.
4. Access token issuance.
5. Refresh token cookie.
6. Frontend API URL.

---

## 23.3 OAuth fails

Check:

1. Client ID and secret.
2. Redirect URI exact match.
3. Provider consent screen.
4. Backend OAuth logs.
5. Email verified status from provider.
6. Frontend redirect destination.

---

## 23.4 Email not sending

Check:

1. Email provider status.
2. API key.
3. Sender domain verification.
4. Spam folder.
5. Backend email logs.
6. Production vs console provider configuration.

---

## 23.5 PWA not working

Check:

1. HTTPS enabled.
2. Manifest path.
3. Icon availability.
4. Service worker registration.
5. Browser console errors.
6. Cache from previous deployment.

---

## 24. Maintenance Tasks

Regular maintenance:

| Task                      | Frequency                   |
| ------------------------- | --------------------------- |
| Review dependency updates | Monthly                     |
| Review security alerts    | Weekly                      |
| Check production logs     | Weekly                      |
| Check backup status       | Monthly                     |
| Review database usage     | Monthly                     |
| Rotate secrets            | As needed or every 6 months |
| Test restore process      | Quarterly                   |
| Clean unused branches     | Monthly                     |

---

## 25. Operational Acceptance Criteria

Operations are complete when:

- Local development works with Dockerized PostgreSQL.
- Environment variables are documented.
- No secrets are committed.
- GitHub Actions CI passes on pull requests.
- Frontend deploys to Vercel.
- Backend deploys to Render.
- Database migrations run safely.
- Backend health check passes in production.
- Email verification works in production.
- OAuth login works in production.
- PWA works over HTTPS.
- Logs are structured and safe.
- Backup/restore strategy exists.
- Rollback process is documented.
- Post-deployment checklist is completed.

---

## 26. Final Operational Architecture

```txt
Developer
  -> Git push
  -> GitHub Actions
      -> lint/typecheck/test/build
  -> Merge to main
      -> Render deploys backend
          -> Pre-deploy: Prisma migrate deploy with migration role
              -> Neon PostgreSQL updated
          -> Express API starts with runtime role
          -> Backend health check passes
      -> Vercel promotes frontend
  -> Health checks
  -> Production traffic
```
