# Backend Implementation Plan

## Job Application Tracker

This plan turns the PRD, backend specification, database specification, operations specification, and Definition of Done into small, sequential backend delivery phases.

## Current State

- `api/` is the standalone Tally API project in the polyrepo workspace.
- `web/` is the separate Next.js frontend project and is deployed independently.
- Cross-repository contracts are versioned API schemas/types, not a pnpm workspace package.

## Implementation Status

- Completed: Phase 0 — API Repository Bootstrap
- Completed: Phase 1 — API Package and Tooling
- Completed: Phase 2 — Runtime Configuration
- Completed: Phase 3 — Prisma Foundation

## Delivery Rules

- Use `/api/v1` for all API routes.
- Keep controllers thin: route -> middleware -> controller -> service -> repository -> Prisma.
- Validate every body, query parameter, route parameter, and relevant cookie with Zod.
- Scope every user-owned query by the authenticated user. Return `404` for unowned resources.
- Add tests with each phase; do not defer security-critical test coverage.
- Use database transactions for multi-table writes and import replacement.

---

## Phase 0 — API Repository Bootstrap

### Scope

- Create a standalone pnpm API package and root scripts for development, linting, type checking, tests, database migration, and seed.
- Create the API source, Prisma, and test directories at repository root.
- Add Docker Compose with a local PostgreSQL service.
- Add one API `.env.example` file.

### Exit criteria

- `pnpm install` works.
- Local PostgreSQL starts with Docker Compose.
- API scripts run directly through `pnpm`.

## Phase 1 — API Package and Tooling

### Scope

- Initialize `api/` with Node.js, Express, TypeScript, and production build scripts.
- Configure ESLint, formatting, Vitest, and Supertest.
- Add TypeScript path/type configuration.
- Create the documented base source-directory structure.

### Exit criteria

- API typecheck, lint, test, and build commands run.
- A minimal Express server starts on the configured port.

## Phase 2 — Runtime Configuration

### Scope

- Implement Zod environment validation.
- Add development and production rules for cookies, email providers, OAuth credentials, and token secrets.
- Fail startup for missing/unsafe production configuration.
- Add typed configuration exports.

### Exit criteria

- Invalid environments fail before the server starts.
- Production rejects console email and insufficient token-secret configuration.

## Phase 3 — Prisma Foundation

### Scope

- Configure Prisma 7, `prisma.config.ts`, generated client path, and `@prisma/adapter-pg` runtime client.
- Add database connection lifecycle handling.
- Add a separate test-database configuration.

### Exit criteria

- Prisma client generation succeeds.
- API can connect to the local and test PostgreSQL databases.

## Phase 4 — Core User and Auth Schema

### Scope

- Add User, OAuthAccount, RefreshToken, EmailVerificationToken, and PasswordResetToken models.
- Add auth, OAuth, and preference enums.
- Apply snake_case physical mappings, timestamp types, relations, unique constraints, and cascade rules.
- Add migration and custom SQL constraints for email-verification consistency.

### Exit criteria

- Migration works from an empty database.
- Auth table relations, uniqueness rules, and cascades are covered by database tests.

## Phase 5 — Application Data Schema

### Scope

- Add Application, Tag, ApplicationTag, Note, Interview, and StatusHistory models.
- Add application/interview enums, indexes, database checks, and cascade rules.
- Add salary, currency, note-length, and tag-length SQL constraints.

### Exit criteria

- Migration works from scratch.
- Database tests verify indexes/constraints/cascades and soft archive fields.

## Phase 6 — Seed and Test Utilities

### Scope

- Add development-only seed data: verified demo user, tags, applications, notes, interviews, and history.
- Add test helpers for database cleanup, authenticated requests, and fixture creation.

### Exit criteria

- Seed works locally and never runs automatically in production.
- Integration tests can run independently against `jobtrack_test`.

## Phase 7 — HTTP Foundation

### Scope

- Separate `app.ts` from `server.ts`.
- Add request ID, structured request logging, Helmet, CORS, JSON size limit, cookie parsing, compression, and 404 handling.
- Add central `ApiError`, async handler, and error middleware.
- Add `GET /api/v1/health` with database connectivity check.

### Exit criteria

- Responses follow the required success/error envelope.
- Health returns 200 when healthy and 503 when database is unavailable.
- Logs include request IDs and redact secrets.

## Phase 8 — Shared Auth Primitives

### Scope

- Implement password hashing, secure random token generation, SHA-256 token hashing, JWT creation/verification, refresh-cookie helpers, and pagination helpers.
- Implement authentication and verified-user middleware.
- Implement allowed-origin plus `X-Requested-With` protection for refresh/logout.

### Exit criteria

- Unit tests cover token expiry, token hashing, JWT validation, and cookie settings.
- Protected endpoints reject missing, invalid, and unverified identities correctly.

## Phase 9 — Registration and Email Verification

### Scope

- Implement email normalization, registration, verification-token issuance, email-service abstraction, console development email provider, verify-email, and resend-verification endpoints.
- Add auth-specific rate limits.

### Exit criteria

- Password and verification token are only stored hashed.
- Verification sets `emailVerified` and `emailVerifiedAt` atomically.
- Registration and verification integration tests pass.

## Phase 10 — Login, Refresh, and Logout

### Scope

- Implement login, `/auth/me`, refresh, refresh rotation, replay detection, and logout.
- Store refresh metadata and revoke sessions as specified.

### Exit criteria

- Login issues a 15-minute access JWT and HTTP-only refresh cookie.
- Refresh rotates correctly; replay revokes all user refresh sessions.
- Logout revokes the current refresh token.

## Phase 11 — Password Recovery and Management

### Scope

- Implement forgot-password, reset-password, change-password, and OAuth-only set-password endpoints.
- Revoke sessions after password reset and other sensitive password changes as specified.

### Exit criteria

- Reset tokens are single-use and expire after 30 minutes.
- Email enumeration is not exposed.
- All password-flow integration tests pass.

## Phase 12 — Google OAuth Login

### Scope

- Add Google authorization and callback endpoints.
- Implement state generation, expiry, consumption, code exchange, profile validation, and account/user resolution rules.

### Exit criteria

- Only verified provider emails can create/link accounts.
- Successful login redirects to the frontend and restores its session through refresh.

## Phase 13 — GitHub OAuth Login

### Scope

- Implement the corresponding GitHub OAuth flow using the same security and account-resolution rules.

### Exit criteria

- GitHub login has equivalent test coverage and safe failure redirects.

## Phase 14 — Connected Accounts

### Scope

- Implement connected-account listing, authenticated provider-link start, user-bound one-time link state, callback linking, and unlink endpoints.

### Exit criteria

- A provider cannot be linked to multiple users.
- Invalid link state never falls back to email-based linking.
- The final remaining login method cannot be removed.

## Phase 15 — User Profile and Preferences

### Scope

- Implement profile and preferences updates.
- Validate name, theme, landing page, notification flag, and IANA time zone.

### Exit criteria

- Email remains read-only.
- Authenticated server preferences are authoritative and valid time zones persist.

## Phase 16 — Application Creation and Detail

### Scope

- Implement create and get-one application endpoints.
- Validate all application fields and user-owned tag IDs.
- Atomically create an application, tag assignments, initial note, and initial non-default status history.

### Exit criteria

- Company and role are required.
- Salary/currency/date/URL rules work.
- The complete create operation rolls back on any failure.

## Phase 17 — Application Update, Archive, and Delete

### Scope

- Implement application update, archive, unarchive, and delete endpoints.
- Support transactional replacement of tag assignments when `tagIds` is supplied.

### Exit criteria

- Status cannot be changed through generic update.
- Archived applications are soft-deleted; child records are removed only on real deletion.

## Phase 18 — Application List, Search, and Filters

### Scope

- Implement pagination, sorting, search, status/tag/remote/employment/source/date/follow-up/archive filters.
- Preserve pagination correctness when matching notes and tags.
- Apply status pipeline rank and stable ID tie-break sorting.

### Exit criteria

- Invalid query values return `VALIDATION_ERROR`.
- Search includes company, role, location, tags, and notes.
- List pagination neither duplicates nor skips equal-sort records.

## Phase 19 — Status Changes and History

### Scope

- Implement dedicated atomic status-change and status-history endpoints.

### Exit criteria

- No-op changes return `CONFLICT`.
- Every actual change creates one immutable history row.

## Phase 20 — Tags

### Scope

- Implement tag list/create/update/delete and application tag add/remove endpoints.
- Normalize tag names before uniqueness checks.

### Exit criteria

- Tag names are unique per user.
- Duplicate assignments are idempotent.
- Tag deletion cascades assignments without deleting applications.

## Phase 21 — Notes

### Scope

- Implement note list/create/update/delete endpoints.

### Exit criteria

- Content is trimmed and constrained to 1–5000 characters.
- Ownership is checked through the parent application.

## Phase 22 — Interviews

### Scope

- Implement interview create/update/delete and global/application-specific listing endpoints.
- Add past/upcoming ranges and archived-application handling.

### Exit criteria

- Time-based ordering and pagination work.
- The update endpoint cannot move an interview to another application.

## Phase 23 — Dashboard

### Scope

- Implement dashboard summary using database aggregates and compact list queries.
- Calculate today/overdue follow-up boundaries using the stored IANA time zone.

### Exit criteria

- Every metric excludes archived applications.
- Active statuses, future scheduled interviews, status counts, and fixed-size lists follow the spec.
- No dashboard calculation loads all user records into memory.

## Phase 24 — JSON Export

### Scope

- Implement raw versioned JSON backup export with file-local references.
- Exclude all credentials, tokens, OAuth identities, and database IDs.

### Exit criteria

- Export response has correct download headers.
- Export contains all portable application data and valid relationships.

## Phase 25 — CSV Export

### Scope

- Implement RFC 4180 CSV application export.
- Encode tags as JSON arrays and neutralize spreadsheet-formula prefixes in user-controlled values.

### Exit criteria

- CSV contains the documented columns and safe download headers.
- Commas, quotes, and formula-like content export safely.

## Phase 26 — JSON Import

### Scope

- Validate the entire version-1 backup payload and 1 MB payload limit before writing.
- Validate references and status-history consistency.
- Replace only portable user data in one database transaction, regenerating all IDs.

### Exit criteria

- Invalid imports make no changes.
- Valid export can be imported without dangling references.
- Account credentials and identities are preserved and never imported.

## Phase 27 — API Test Completion

### Scope

- Complete unit tests for utilities, services, validators, and pagination.
- Complete Supertest integration coverage for every documented endpoint, validation failure, authorization failure, and security flow.

### Exit criteria

- Backend testing checklist in `definition-of-done.md` is satisfied.
- Tests use a separate PostgreSQL database and pass from a clean migration.

## Phase 28 — CI, Container, and Deployment Readiness

### Scope

- Add GitHub Actions PostgreSQL test workflow.
- Add API Dockerfile and deployment configuration.
- Configure production build/start/migration commands and separate runtime versus migration credentials.

### Exit criteria

- CI runs install, Prisma generate/migrate, lint, typecheck, test, and build.
- Production environment validation and health-check contract are deployable.

## Phase 29 — Release Verification

### Scope

- Run a complete local smoke test and security review.
- Verify OAuth/email provider configuration, CORS/cookies, logs, backups, monitoring, and rollback documentation in staging/production.
- Support frontend E2E work for the critical flows.

### Exit criteria

- Backend, database, operations, and release-checklist sections of `definition-of-done.md` pass.
- Production deployment returns a healthy `/api/v1/health` response and no sensitive data appears in logs.

---

## Dependency Order

```txt
0–3 foundation
  -> 4–6 database
    -> 7–8 HTTP/security primitives
      -> 9–14 authentication and OAuth
        -> 15 preferences
          -> 16–22 application resources
            -> 23 dashboard
              -> 24–26 portability
                -> 27–29 testing and release
```

## Reference Documents

- `prd.md`
- `backend-spec.md`
- `database-spec.md`
- `operations-spec.md`
- `definition-of-done.md`
- `reconciliation-report.md`
