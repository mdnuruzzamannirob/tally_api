# Backend Refactor Plan

## Purpose

The API feature set is already implemented. This plan refactors its internals
to the approved feature-first layered architecture without changing documented
routes, database behavior, authentication flow, or export/OAuth exceptions.
`backend-implementation-plan.md` remains the original feature-delivery record.

## Final architecture rules

- `route → middleware → controller → service → repository → Prisma` is the
  required dependency direction.
- Routes only declare HTTP mappings. Controllers validate/read HTTP input and
  return the standard envelope. Services own business policy and transaction
  coordination. Repositories contain every Prisma query/transaction.
- Modules use kebab-case folders and singular resource files: `*.routes.ts`,
  `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.validators.ts`,
  `*.types.ts`, and `*.constants.ts` where applicable.
- Shared code lives in `config`, `lib`, `middleware`, `email`, `oauth`,
  `routes`, `types`, and `utils`; no module reaches into another module's
  repository.
- All normal JSON responses use `{ success, message, data/error, meta }`.
  `data` is the direct payload: objects for single resources and arrays for
  collections, never an `items` wrapper; pagination belongs in `meta`.

## Phase 0 — Shared foundation — Complete (2026-08-10)

- Establish `lib/api-error.ts`, `lib/async-handler.ts`, `lib/pagination.ts`,
  `lib/jwt.ts`, `lib/crypto.ts`, `lib/prisma.ts`, and `lib/logger.ts`.
- Establish shared constants and the versioned route composition entry point.
- Split Prisma into `prisma/schema/base.prisma`, `enums/`, and `models/`,
  keeping migrations and generated client paths unchanged.
- Implement `contracts/openapi.json` as the OpenAPI 3.1 source artifact,
  expose `/api/v1/openapi.json` and `/api/v1/docs` (Swagger UI), then add
  schema validation and envelope/contract guard tests.

**Done when:** Prisma validates without a migration, OpenAPI validates, every
JSON success has a message, errors have `meta.requestId`, and paginated
responses expose `meta`.

**Completed:** The shared `lib` implementations now own API errors, async
handling, pagination, JWT, token crypto, and response envelopes; legacy paths
remain as compatibility re-exports until their feature phases migrate imports.
The multi-file Prisma schema validates without a migration. The OpenAPI 3.1
release artifact is validated in CI and is served at `/api/v1/openapi.json`
with Swagger UI at `/api/v1/docs`; app tests cover both endpoints.

## Phase 1 — Auth, users, email, OAuth

- Create full repository/controller/service/type/constants boundaries for auth
  and users; profile/preferences leave `AuthService` for `UsersService`.
- Move password, verification, refresh, reset, OAuth-state, and connected
  account persistence into `AuthRepository`.
- Keep OAuth provider integrations in top-level `oauth/`; keep provider HTTP
  and email-provider details outside feature services.

**Done when:** no auth/user service imports Prisma; existing security and
cookie integration tests pass unchanged except for the approved envelope.

## Phase 2 — Applications and tags

- Extract application/tag repositories for all ownership-scoped reads/writes,
  filtering, pagination, status history, archive actions, and tag assignment.
- Create controllers and constants; routes retain middleware/controller mapping
  only.
- Keep status policy and multi-table transaction orchestration in services.

**Done when:** services have no Prisma access and ownership, filter, archive,
status-transition, and pagination tests pass.

## Phase 3 — Notes and interviews

- Apply the complete module pattern to notes and interviews.
- Query child entities through user-scoped application ownership in repositories.
- Preserve application child endpoints and global interview list semantics.

**Done when:** CRUD, filter, pagination, and cross-user `404` tests pass.

## Phase 4 — Dashboard, import/export, health

- Move dashboard aggregates to a repository and leave summary shaping in the
  service.
- Split import/export into separate controller/service/repository layers while
  preserving import transactions and raw download responses.
- Add health controller/service/database probe and preserve the unauthenticated
  `503` health failure contract.

**Done when:** dashboard, import/export, health, smoke, and container checks pass.

## Phase 5 — Cleanup and release

- Migrate imports into the approved `lib`, `oauth`, and `utils` locations;
  remove only legacy files with no remaining imports.
- Add CI validation that blocks Prisma imports outside repositories and
  `lib/prisma.ts`.
- Run full PostgreSQL integration tests, Docker build, migration deploy, and
  release smoke test.

## Documentation and frontend handoff

- Update architecture, database, operations, testing, deployment, and DoD docs
  only after each phase is complete.
- Release/version `contracts/openapi.json` with each contract change; the web
  repository pins and validates that artifact before deployment.
- The untouched web project implements from its own docs in order: foundation
  and `app-ui`, auth, dashboard, applications/tags/notes, interviews, settings,
then import/export. Each feature consumes the released, versioned API contract.
