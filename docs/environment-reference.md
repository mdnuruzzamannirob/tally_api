# Environment values: what is shared and what stays separate

The API keeps the same numbered sections in `.env`, `.env.production`, `.env.test`
and their example templates. Only settings used by that profile are included.
Real credentials belong to ignored actual env files; examples contain placeholders.

## Profile selection

| Mode                            | API file                      | Purpose                                                        |
| ------------------------------- | ----------------------------- | -------------------------------------------------------------- |
| Development or unset `NODE_ENV` | `.env`                        | Local database/API/frontend with real Resend email             |
| Production `NODE_ENV`           | `.env.production`, if present | Hosted database, public HTTPS URLs and production credentials  |
| Test `NODE_ENV`                 | `.env.test`                   | Isolated test database, console email and no background worker |

Injected process variables override file values. Production and tests do not fall
back to the local file. The API and Prisma CLI use the same profile loader.

## Value placement

| Setting                             | Local                                                       | Production/staging                                      | Test                                        | Sharing rule                                                                             |
| ----------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `NODE_ENV`                          | `development`                                               | `production`                                            | `test`                                      | Different for each profile                                                               |
| `PORT`                              | `5000`                                                      | `5000` or platform-provided                             | `4001`                                      | Local/production may match                                                               |
| `LOG_LEVEL`                         | `debug`                                                     | `info`                                                  | `warn`                                      | Match the profile's needs                                                                |
| `POSTGRES_*`                        | Local Docker database settings                              | Not needed for an externally managed database           | Uses local server through its URL           | Local infrastructure settings only                                                       |
| `DATABASE_URL`                      | Local `tally` database                                      | Managed production database                             | Isolated `tally_test` database              | Never point local/test at production                                                     |
| `TEST_DATABASE_URL`                 | Not needed                                                  | Not needed                                              | Same isolated target as test `DATABASE_URL` | Test only                                                                                |
| `MIGRATION_DATABASE_URL`            | Empty falls back to local database                          | Same database with an optional dedicated migration role | Not needed                                  | Never use production migration credentials locally by accident                           |
| `API_BASE_URL`                      | `http://localhost:5000`                                     | Public Render API URL                                   | Local test API URL                          | Different origins                                                                        |
| `WEB_APP_URL`                       | `http://localhost:3000`                                     | Public Vercel frontend URL                              | Local test frontend URL                     | Email links/callback destinations follow this profile                                    |
| `ACCESS_TOKEN_SECRET`               | Local-only secret                                           | Production-only secret                                  | Fixed test-only secret                      | All three must stay different                                                            |
| Token lifetimes                     | `15m` / `7d`                                                | `15m` / `7d`                                            | Defaults unless explicitly overridden       | May match                                                                                |
| Cookie secure / sameSite            | `false` / `lax`                                             | `true` / `none`                                         | `false` / `lax`                             | Local HTTP differs from cross-site production HTTPS                                      |
| `EMAIL_PROVIDER`                    | `resend`                                                    | `resend`                                                | `console`                                   | Local/production provider may match                                                      |
| `EMAIL_API_KEY`                     | Prefer a local sending key; current existing key retained   | Production sending key                                  | Empty                                       | Local/production can share, but separate keys are preferred; never use in tests/frontend |
| `EMAIL_FROM`                        | Test sender or verified sender                              | Verified domain sender                                  | `no-reply@tally.test`                       | A verified sender may be shared between local/production                                 |
| `EMAIL_API_BASE_URL`                | Empty for the official endpoint                             | Empty for the official endpoint                         | Not needed                                  | Empty is intentional                                                                     |
| `NOTIFICATION_WORKER_ENABLED`       | `true`                                                      | `true`                                                  | `false`                                     | Same live behavior locally; tests run jobs explicitly                                    |
| `RESEND_WEBHOOK_SECRET`             | Empty or local tunnel endpoint secret                       | Production endpoint secret                              | Empty                                       | Separate for each webhook endpoint; not required for outbound email                      |
| Google OAuth credentials            | Local app preferred; one app can include both callback URLs | Production app credentials                              | No live credentials                         | Shared app requires correct callback registration                                        |
| GitHub OAuth credentials            | Separate local OAuth app for the local callback             | Production app for the production callback              | No live credentials                         | Use separate apps when callback origins differ                                           |
| Alternative email provider settings | Leave unused credentials empty                              | Fill only when selecting that provider                  | No live credentials                         | Not used while `EMAIL_PROVIDER=resend`                                                   |

## Current credential placement

- Local, production and test JWT secrets are already different.
- Local and test use different database names. Production has its own managed database.
- The local Resend API key currently matches the existing production key. It was retained so local delivery remains configured. A dedicated local key can replace just the local value later.
- Local Google/GitHub credentials currently match the existing production credentials. They were retained rather than replaced with invented or blank credentials. Register the appropriate callback URLs; replace the local GitHub credentials with a local app's values when available.
- Webhook secrets are intentionally omitted from actual env files until endpoints are configured; blank placeholders remain in examples. Do not paste an `re_...` API key into this field; it expects an endpoint-specific `whsec_...` secret.
- The current local/production sender is still `onboarding@resend.dev`. Local testing is restricted to the allowed Resend account recipient. The application can start with this sender, but Resend limits it to the account owner. A verified-domain sender is needed for other recipients; no domain address was invented during formatting.

## Frontend values

The frontend contains public browser configuration only:

| Setting               | Local `tally_web/.env`         | Production `tally_web/.env.production`       |
| --------------------- | ------------------------------ | -------------------------------------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000/api/v1` | `https://tally-api-stag.onrender.com/api/v1` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000`        | `https://tallywebsite.vercel.app`            |

These URLs must agree with the corresponding API profile. Resend, JWT, database
and OAuth client secrets never belong in frontend env files. The existing tracked
frontend production file contains public URLs only; do not add secrets to it.
Next.js applies its own env precedence, so a `.env.local` override can affect a
production build too. The current setup does not require that extra override file.

For startup commands and remaining Docker/domain/OAuth setup, see
[local-setup.md](local-setup.md). For deployment and delivery tracking, see
[email-notifications.md](email-notifications.md).

For a direct step-by-step checklist covering database migrations, sender domains and webhook secrets, see [env-setup-checklist.md](env-setup-checklist.md).
