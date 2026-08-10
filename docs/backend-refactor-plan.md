# Backend Refactor Plan

## Purpose and non-negotiable rules

The API behavior already exists. This refactor changes code ownership only:
routes, status codes, envelope shape, database schema, migrations, refresh
cookie, OAuth redirects, and raw export responses must not change. The
delivery history in `backend-implementation-plan.md` is not edited.

Every phase is atomic: change one bounded area, run its gate, then update this
document. Do not create compatibility facades, duplicate implementations, or
mark a phase complete before its gate passes. Repositories own every Prisma
query and transaction; services own policy and orchestration; controllers own
HTTP; routes only compose middleware and controllers.

## Baseline gate — required before every phase

- Capture the affected existing integration tests and run them before editing.
- Run `pnpm typecheck` and `pnpm test:unit` after each bounded change.
- Run `pnpm test:integration` after any database-facing phase against the
  dedicated disposable `TEST_DATABASE_URL` described in `testing.md`.
- If a gate fails, fix or revert that phase before starting another one.

## Phase 0 — Shared foundation — complete

Shared helpers now have one home: `lib` owns API errors, async handling,
pagination, envelopes, JWT, opaque-token crypto, and password hashing;
`config/cookie.ts` owns refresh-cookie behavior. Prisma is split under
`prisma/schema`, OpenAPI is validated and served, and legacy helper paths are
removed.

**Recorded gate:** typecheck, unit/app tests, build, Prisma validation, and
OpenAPI validation pass. Do not reopen Phase 0 unless a shared-helper change is
required by a later phase.

## Phase 1 — Identity boundary

### 1.1 Auth repository: registration and verification

- Implement `AuthRepository` methods for user lookup, registration plus email
  verification-token creation, verification-token lookup/consume, and resend
  replacement transaction.
- Change only those `AuthService` methods to repository calls; keep hashing,
  expiry policy, token generation, email dispatch, and domain errors in the
  service.
- **Gate:** registration and verification integration tests; no `PrismaClient`,
  `.prisma`, or `.client` usage remains in the migrated service methods.

### 1.2 Auth repository: login, refresh, and logout

- Add repository methods for password-login user lookup, refresh-session
  creation, token lookup with user, atomic rotation, single-token revocation,
  and all-session revocation.
- Migrate login/refresh/logout service methods without changing `tally_rt`,
  replay handling, origin checks, or error codes.
- **Gate:** session integration tests, including rotation and replay revocation.

### 1.3 Auth repository: password lifecycle

- Add repository methods for reset-token replacement/consume, password update,
  and required session revocation transactions.
- Migrate forgot/reset/change/set password service methods.
- **Gate:** password-management integration tests, expired/used token cases,
  and current-session preservation behavior.

### 1.4 Users module

- Create `user.types.ts`, `user.constants.ts`, `user.repository.ts`,
  `user.service.ts`, and `user.controller.ts`.
- Move profile/preferences from `AuthService`; `users.routes.ts` contains only
  authentication middleware and controller mappings.
- **Gate:** user-preferences integration tests and an audit that `AuthService`
  has no profile/preferences persistence method.

### 1.5 Auth connected accounts

- Add repository methods for connected-account reads and serializable unlink
  protection; migrate service logic without changing last-login-method rules.
- **Gate:** connected-account integration tests and conflict/not-found cases.

### 1.6 OAuth repository: state and identity persistence

- Implement provider-neutral `OAuthRepository` methods for state creation and
  atomic single-use consumption, account lookup/linking, OAuth user
  resolution/creation, and OAuth refresh-session creation.
- Google/GitHub services retain only provider HTTP exchange, verified-email
  policy, and redirect-result orchestration. Remove all Prisma imports/calls
  and temporary `PrismaClient | Repository` constructors.
- **Gate:** Google and GitHub OAuth integration tests for login, callback
  failure, state reuse, linking, duplicate identity, and refresh-cookie result.

### 1.7 Identity cleanup gate

- Delete facades, compatibility constructors, and dead identity code.
- `rg` must show Prisma imports only in `*.repository.ts` and `lib/prisma.ts`;
  `AuthService`, `UserService`, `GoogleOAuthService`, and `GitHubOAuthService`
  must have no Prisma call or client exposure.
- **Gate:** `pnpm test:all`, `pnpm typecheck`, `pnpm build`, `pnpm prisma:validate`,
  `pnpm openapi:validate`, Docker build, and release smoke test. Only then mark
  Phase 1 complete.

## Phase 2 — Applications and tags

Split this into application create/detail, application list/filter/pagination,
application update/archive/delete, status history, tag CRUD, and application
tag assignment/removal. Each subphase gets its own repository, controller,
ownership tests, and no-Prisma service audit before the next begins.

## Phase 3 — Notes and interviews

Refactor notes CRUD, application interviews, global interviews, and interview
updates/deletes as separate gated subphases. Child-resource repository queries
must enforce application ownership.

## Phase 4 — Read and transfer modules

Refactor dashboard aggregates, JSON/CSV export, JSON import transactions, and
health database probe separately. Raw downloads and OAuth redirects remain the
only response-envelope exceptions.

## Phase 5 — Release hardening

Add the repository-boundary CI audit, execute the full release checklist in
`release-verification.md`, validate the Docker migration/runtime images, and
release the matching versioned OpenAPI contract only after all prior gates pass.
