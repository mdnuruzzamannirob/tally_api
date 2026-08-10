# Backend Refactor Plan

## 1. Purpose

The backend feature set is already implemented. This document defines the
small, gated migration from the current implementation to the layered modular
architecture described in backend-spec.md.

This is an ownership refactor, not a product rewrite. The refactor must keep
the existing HTTP and database behavior stable while moving responsibilities to
their correct layers.

The canonical flow is:

```txt
Route -> Middleware -> Controller -> Service -> Repository -> Prisma -> PostgreSQL
```

The implementation history in backend-implementation-plan.md is not edited.
This document tracks only the refactor work and its gates.

---

## 2. Non-negotiable preservation contract

Unless a separate approved bug fix is explicitly documented, refactoring must
not change:

- route paths, HTTP methods, query names, or request payloads;
- status codes, error codes, error messages, or success/error envelopes;
- authentication and authorization behavior;
- refresh-cookie name/settings, rotation, replay handling, or CSRF checks;
- OAuth provider callbacks, state expiry/consumption, account-linking rules, or
  redirect selection;
- ownership behavior, including returning 404 for unowned resources;
- transaction boundaries and atomicity of multi-table writes;
- Prisma schema, migrations, physical column mappings, or seed expectations;
- JSON/CSV raw download content and headers;
- import replacement semantics and rollback behavior;
- the versioned OpenAPI contract.

If a needed change violates this contract, stop the phase and record it as a
separate design decision before continuing.

---

## 3. Current audit snapshot

Audit basis: reconciliation-report.md, backend-spec.md, database-spec.md,
testing.md, release-verification.md, and the current api/src tree at the start
of this plan.

### 3.1 What is already in place

- Shared helpers have been consolidated under src/lib and cookie behavior is
  under src/config/cookie.ts.
- AuthRepository contains most registration, verification, session, and
  password persistence operations.
- The users module has user.repository.ts, user.service.ts,
  user.controller.ts, and users.routes.ts.
- Auth controllers and route-level middleware are present.
- OpenAPI serving/validation, Prisma schema splitting, and the documented test
  database flow are already present.
- Existing integration coverage covers the implemented auth and feature flows.

### 3.2 Findings that drive the migration order

| Finding                                          | Current evidence                                                                                                                                         | Required outcome                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Auth compatibility boundary remains              | AuthService accepts AuthRepository or PrismaClient, exposes a Prisma getter, and still persists profile/preferences and connected-account reads directly | Remove the union constructor, Prisma getter, and every direct Prisma call from AuthService     |
| User migration is incomplete                     | UserRepository/UserService exist, but AuthService still owns profile/preferences persistence                                                             | Make user persistence exclusively owned by the users boundary                                  |
| OAuth repository is only a shell                 | OAuthRepository currently exposes the Prisma client; Google/GitHub services still contain Prisma calls and compatibility constructors                    | Add provider-neutral persistence methods and leave provider HTTP/policy in OAuth services      |
| Feature services bypass repositories             | Application, tag, note, interview, dashboard, export, and import services import/use PrismaClient directly                                               | Add repositories and keep query/transaction code out of services                               |
| Feature routes contain HTTP orchestration        | Feature route files call service methods and perform request parsing/response mapping inline                                                             | Add controllers; routes should only compose middleware and controller handlers                 |
| Composition is coupled to Prisma-backed services | app.ts constructs most feature services with the global Prisma client                                                                                    | Compose repositories first, then services, then controllers/routes                             |
| Tests encode the old constructor shape           | Integration tests instantiate feature services with PrismaClient; OAuth tests pass Prisma directly                                                       | Update test factories to inject repositories and keep Prisma only in repository/database tests |
| Boundary enforcement is manual                   | No CI check rejects Prisma imports from services/controllers/routes                                                                                      | Add a repeatable repository-boundary audit before final completion                             |

### 3.3 Baseline recorded for this plan

- pnpm typecheck: passed during plan preparation.
- pnpm test:unit: attempted; HTTP tests could not bind a Supertest server in
  the restricted execution environment (listen EPERM). The seven failures are
  environment binding failures, not assertion failures. Re-run in normal
  CI/local execution before accepting any phase gate.
- No database migration is required by the architectural target. A migration
  must not be added merely to complete this refactor.

---

## 4. Target structure

Each feature module should converge on this shape:

```txt
src/modules/<feature>/
├── <feature>.routes.ts
├── <feature>.controller.ts
├── <feature>.service.ts
├── <feature>.repository.ts
├── <feature>.validators.ts
├── <feature>.types.ts        # only when shared types are needed
└── <feature>.constants.ts    # only when feature constants are needed
```

The following exceptions are intentional:

- src/lib/prisma.ts is the only application runtime Prisma client factory.
- src/oauth/*.oauth.ts owns provider HTTP clients and provider response parsing.
- src/oauth/*-oauth.service.ts owns provider flow orchestration and policy;
  persistence goes through src/oauth/oauth.repository.ts.
- src/modules/export-import/ may contain separate export/import repositories
  because their read and replacement transaction shapes are materially
  different.
- Health may remain a cross-cutting route, but it still needs a thin controller
  and an injected database-health dependency.

Layer rules:

| Layer        | Owns                                                                                | Must not own                                                |
| ------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Routes       | URL, HTTP method, middleware order, handler mapping                                 | business logic, Prisma, response formatting                 |
| Controllers  | parse validated HTTP input, read auth/request metadata, call service, send response | Prisma, policy, transactions                                |
| Services     | business rules, normalization, policy, orchestration                                | Express response/request details, Prisma queries            |
| Repositories | Prisma queries, transactions, persistence-specific projections                      | HTTP status codes, provider policy, password hashing policy |
| Middleware   | auth, verification, request IDs, rate limits, CSRF/origin checks, errors            | feature persistence                                         |

---

## 5. Execution protocol for every micro-step

Every step below is completed in this order:

1. Identify the affected routes and integration tests.
2. Run the baseline gate before editing.
3. Add or move one bounded persistence/HTTP responsibility.
4. Migrate dependency injection and affected tests in the same step.
5. Run the step gate.
6. Run the static boundary audit for the touched module.
7. Record the result in the status table in this document.

Do not start the next step while the current step has a failing gate. Do not
use compatibility constructors, duplicate implementations, temporary facades,
or any casts to hide an unfinished migration.

### Required gates

Fast gate after every step:

```sh
pnpm typecheck
pnpm test:unit
```

Database gate after every repository or transaction step:

```sh
pnpm prisma:validate
pnpm prisma:deploy
pnpm test:integration
```

Contract/build gate at the end of each phase:

```sh
pnpm lint
pnpm format
pnpm typecheck
pnpm test:all
pnpm build
pnpm openapi:validate
```

The integration suite must use the disposable TEST_DATABASE_URL described in
testing.md; a missing test database must fail the run rather than skip it.

---

## 6. Status convention

- Complete — implementation and gate are recorded as passing.
- In progress — implementation has started but the gate is not complete.
- Pending — dependency has not been started.
- Blocked — the same external blocker has been reproduced three times and
  requires an explicit decision or environment change.

Status must be updated only after the relevant gate passes.

---

## 7. Phase status overview

| Phase | Scope                                        | Status at plan creation                                           |
| ----- | -------------------------------------------- | ----------------------------------------------------------------- |
| 0     | Shared foundation and contract preservation  | Complete                                                          |
| 1     | Identity, users, connected accounts, OAuth   | In progress — auth repository partial; user/OAuth cleanup pending |
| 2     | Applications and tags                        | Pending                                                           |
| 3     | Notes and interviews                         | Pending                                                           |
| 4     | Dashboard, health, export, and import        | Pending                                                           |
| 5     | Composition, tests, and boundary enforcement | Pending                                                           |
| 6     | Release hardening and sign-off               | Pending                                                           |

---

## 8. Phase 0 — Shared foundation

Status: Complete.

Already established:

- one home for API errors, async handling, pagination, response envelopes,
  JWT, opaque-token hashing, and password hashing;
- refresh-cookie behavior under config/cookie.ts;
- split Prisma schema and OpenAPI artifact/serving;
- removal of the old shared-helper paths.

Reopen this phase only if a later migration exposes a genuine shared-boundary
defect. Do not use it as a place to put feature-specific persistence.

---

## 9. Phase 1 — Identity boundary

Goal: auth, users, and OAuth services contain policy/orchestration only; all
identity persistence is behind repositories.

### 1.1 Lock the identity baseline

- Capture registration, verification, login, refresh, logout, password,
  preferences, connected-account, Google, and GitHub integration tests.
- Record current response snapshots for success, conflict, unauthorized,
  forbidden, not-found, and invalid-token cases.
- Add a temporary audit command/query that lists Prisma imports and constructor
  unions in identity files.

Gate: baseline tests run in a normal environment; pnpm typecheck passes.

### 1.2 Finish auth repository ownership

- Keep registration/verification, login/session rotation, logout, and password
  lifecycle queries in src/modules/auth/auth.repository.ts.
- Confirm transaction boundaries for verification, refresh rotation, password
  reset, password change, and session revocation.
- Return narrow persistence results rather than exposing the repository client
  to services.
- Preserve opaque token hashing, expiry checks, replay revocation, and current
  refresh-session preservation exactly.

Gate: auth/session/password integration tests pass; repository tests cover
atomic success and failed conditional updates.

### 1.3 Remove the AuthService compatibility boundary

- Change the constructor to accept only AuthRepository.
- Delete the PrismaClient import, AuthRepository or PrismaClient union, and
  prisma getter from auth.service.ts.
- Move profile/preferences persistence to UserRepository calls and move
  connected-account reads to the selected identity repository boundary.
- Keep AuthService methods only for auth policy: identity verification,
  hashing, token generation, session policy, and domain errors.

Gate: no Prisma import/call remains in AuthService; auth and password
integration tests pass unchanged at the HTTP contract level.

### 1.4 Complete the users module

- Make user.repository.ts return the public-user projection required by
  /auth/me and user update responses.
- Keep profile, preferences, IANA time-zone, and optional notification
  persistence in the users boundary.
- Keep user.controller.ts responsible for parsing profile/preferences input and
  sending the existing envelope.
- Ensure users.routes.ts contains only auth middleware and controller mapping.
- Remove duplicate profile/preferences validators/types from auth if they are no
  longer owned there; preserve the existing schema behavior.

Gate: user-preferences integration tests pass; AuthService has no profile or
preferences persistence method; response snapshots are unchanged.

### 1.5 Complete connected-account persistence

- Add repository methods for connected-account projection, provider lookup, and
  serializable unlink protection.
- Keep the last-login-method rule in the service/policy layer, with the
  repository returning an explicit outcome for missing user, missing account,
  last method, and successful unlink.
- Keep provider names, conflict/not-found behavior, and authenticated route
  shape unchanged.

Gate: connected-account tests cover listing, duplicate provider, invalid
provider, missing account, unlink success, and last-login-method conflict.

### 1.6 Implement the OAuth repository

- Replace OAuthRepository's exposed Prisma client with provider-neutral methods
  for:
  - state/link-state creation;
  - atomic single-use state consumption and expiry handling;
  - provider-account lookup and unique linking;
  - user lookup and OAuth user creation/resolution;
  - refresh-session creation after OAuth login.
- Use repository transactions for user/account/session creation and provider
  linking.
- Keep Google/GitHub services limited to authorization URL construction, code
  exchange, profile validation, verified-email policy, redirect-result
  orchestration, and domain errors.
- Remove PrismaClient imports and PrismaClient or OAuthRepository constructors
  from both provider services.

Gate: Google/GitHub tests pass for login, callback failure, state reuse, expired
state, duplicate identity, authenticated linking, unverified provider email,
and refresh-cookie issuance.

### 1.7 Identity composition and cleanup

- Update app.ts to construct identity repositories, then services, without
  compatibility fallbacks.
- Update OAuth and auth test factories to inject repositories.
- Keep provider HTTP clients mockable without a database client in the service.
- Delete dead facades, temporary constructors, and unused imports.

Identity completion audit:

```sh
rg -n "PrismaClient|\\.prisma|\\.client|PrismaClient \\\\|" \
  src/modules/auth src/modules/users src/oauth --glob '*.ts'
```

Allowed results are repository files and the Prisma infrastructure itself; no
service/controller/route may expose a Prisma client.

Phase 1 gate:

```sh
pnpm lint
pnpm typecheck
pnpm test:all
pnpm build
pnpm prisma:validate
pnpm openapi:validate
```

---

## 10. Phase 2 — Applications and tags

Goal: application and tag persistence is isolated, while all ownership,
atomic writes, filters, sorting, and status-history behavior remain unchanged.

### 2.1 Application repository foundation

- Create src/modules/applications/application.repository.ts.
- Move application reads and writes from ApplicationService into named
  repository methods.
- Define repository projections for detail, list, mutation result, and status
  history instead of returning arbitrary Prisma payloads.
- Keep user ownership predicates inside repository methods so every query is
  scoped by userId.

Gate: application create/detail tests and ownership tests pass; service has no
Prisma import.

### 2.2 Application create and detail

- Add controller handlers for create and detail.
- Move request parsing and response mapping out of application.routes.ts.
- Preserve atomic creation of application, optional initial note, initial tags,
  and initial status history as specified by the reconciliation report.
- Preserve 201 create behavior, detail projection, tag shape, and error codes.

Gate: create/detail integration tests pass, including initial note/tags,
duplicate/invalid tag behavior, and cross-user 404 behavior.

### 2.3 Application list, search, filters, and pagination

- Move list query construction to the repository.
- Preserve appliedFrom, appliedTo, includeArchived, search fields (company,
  role, location, tags, notes), sort order, deterministic tie-breaks, and
  pagination metadata.
- Ensure note search does not duplicate application rows or totals.
- Keep query validation in validators/controller boundary, not in the repository.

Gate: list/filter integration tests pass for all documented query names, empty
results, note search, archived inclusion, pagination boundaries, and stable
sorting.

### 2.4 Application mutation and status history

- Move update, archive/unarchive, delete, status change, and history queries to
  the repository.
- Preserve the transaction that writes a non-default status-history entry.
- Keep optional status-note handling before the status mutation.
- Keep all mutation ownership checks and 404 behavior unchanged.

Gate: mutation/history tests pass for no-op status changes, status notes, archive
visibility, delete cascades, and cross-user access.

### 2.5 Tags and application-tag assignments

- Create tag.repository.ts and tag.controller.ts.
- Move tag CRUD, assignment replacement, and single-tag removal queries to the
  repository.
- Preserve user-scoped tag uniqueness, tag length/color validation, assignment
  ownership, and transaction behavior.
- Keep application-tag.routes.ts as middleware/controller composition only.

Gate: tag integration tests pass for CRUD, duplicate names, replacement,
remove, invalid IDs, and cross-user ownership.

### 2.6 Applications/tags cleanup

- Update app.ts dependency composition and all affected test factories.
- Remove direct Prisma imports from application/tag services, controllers, and
  routes.
- Confirm no endpoint or OpenAPI diff was introduced.

Phase 2 gate: full contract/build gate plus application/tag integration tests and
the repository-boundary audit for both modules.

---

## 11. Phase 3 — Notes and interviews

Goal: child-resource ownership and persistence are explicit and testable.

### 3.1 Notes repository and controller

- Create note.repository.ts and note.controller.ts.
- Move list/create/update/delete queries to the repository.
- Keep parent-application ownership predicates in every child query.
- Preserve note-content limits, ordering, search behavior, response shape, and
  404 behavior for an unowned parent or note.
- Keep nested application-note routes and global note mutation routes mapped to
  controllers.

Gate: note integration tests pass for CRUD, ordering, ownership, and
validation; NoteService has no Prisma import.

### 3.2 Interviews repository and controller

- Create interview.repository.ts and interview.controller.ts.
- Move application-scoped and global list queries, create, update, and delete
  into the repository.
- Preserve upcoming/past ranges, archived filtering, pagination, deterministic
  ordering, and parent ownership checks.
- Keep date parsing/validation at the HTTP boundary and scheduling policy in the
  service.

Gate: interview integration tests pass for nested/global list, pagination,
archived behavior, CRUD, and cross-user access.

### 3.3 Child-resource cleanup

- Update route factories, app.ts, and test dependency factories.
- Add repository contract tests for parent ownership predicates.
- Remove direct Prisma imports from notes/interviews services, controllers, and
  routes.

Phase 3 gate: full contract/build gate plus notes/interviews integration tests
and boundary audit.

---

## 12. Phase 4 — Read and transfer modules

Goal: complex read models and data-transfer transactions have explicit
repository boundaries without changing raw response exceptions.

### 4.1 Dashboard repository and controller

- Create dashboard.repository.ts and dashboard.controller.ts.
- Move aggregate counts, status grouping, follow-up lists, upcoming interviews,
  and recent applications into repository read methods.
- Keep time-zone day-boundary calculation and metric policy in the service.
- Preserve archived exclusion, active-status set, offer count, scheduled
  interview semantics, deterministic list ordering, and dashboard response
  structure.

Gate: dashboard integration tests pass for time zones, today/overdue
boundaries, archived records, status counts, and list limits.

### 4.2 Export repository and controller

- Add export read methods for the canonical portable JSON projection and CSV
  projection.
- Keep JSON/CSV serialization, CSV formula neutralization, content type,
  download headers, and raw response behavior in the export service/controller.
- Do not wrap downloads in the normal success envelope.

Gate: JSON and CSV byte/semantic snapshots, ordering, null handling,
formula-injection protection, and user isolation pass.

### 4.3 Import repository and controller

- Add an import repository that owns the complete replacement transaction.
- Keep schema validation, version checks, reference validation, and domain
  policy in the import validator/service.
- Preserve the canonical backup shape, profile fields, generated ID mapping,
  cascaded replacement, and rollback-on-any-error behavior.
- Never import email, password, OAuth, refresh-token, or other identity data.

Gate: import integration tests pass for valid replacement, all child data,
invalid references, duplicate references, and transaction rollback.

### 4.4 Health boundary

- Keep the database probe dependency injectable.
- Add a thin health controller/service if needed by the final structure; keep
  health.routes.ts limited to route and handler composition.
- Preserve 200 healthy and 503 unavailable behavior, response envelope,
  request-ID propagation, and redacted logging.

Gate: app/health tests pass in a normal environment and no database client is
constructed by a route/controller.

### 4.5 Read/transfer cleanup

- Update app.ts composition and all feature test factories.
- Remove direct Prisma imports from dashboard/export/import services and routes.
- Confirm raw download and OAuth redirect exceptions remain the only intentional
  response-envelope exceptions.

Phase 4 gate: full contract/build gate, all read/transfer integration tests,
and boundary audit.

---

## 13. Phase 5 — Composition, test architecture, and enforcement

### 5.1 Final dependency composition

- Make app.ts the composition root: infrastructure client -> repositories ->
  services -> controllers/routes.
- Keep server.ts responsible only for process startup and shutdown.
- Avoid importing the global Prisma singleton inside feature constructors.
- Ensure every service can be unit-tested with a repository stub/port.

Gate: app construction succeeds with test doubles for every feature; no feature
test needs a live Prisma client unless it is explicitly a repository or
integration test.

### 5.2 Test factory migration

- Add repository fixtures/stubs for service unit tests.
- Keep database fixture helpers and PrismaClient imports under tests/helpers,
  repository tests, and integration tests only.
- Update existing integration tests to inject repositories through the same
  composition path used by production.
- Add focused service tests for policy that should not require HTTP or a real
  database.

Gate: pnpm test:unit and pnpm test:integration pass in normal CI; tests do not
depend on compatibility constructors.

### 5.3 Automated repository-boundary audit

Add a small deterministic CI check that fails when:

- a service/controller/route imports generated Prisma types or lib/prisma;
- a service/controller/route calls transaction/model methods or exposes a
  Prisma client;
- a route contains feature business logic instead of delegating to a
  controller;
- compatibility constructor unions or dead facades are reintroduced.

Allowed Prisma locations should be explicit rather than inferred:
lib/prisma, feature repositories, OAuth repository, database helpers, and
generated code.

Gate: the audit passes locally and in CI, with at least one negative fixture
proving that a forbidden service import fails the check.

### 5.4 Documentation and contract review

- Update api/docs/README.md only if the final file map needs clarification.
- Keep backend-implementation-plan.md as historical delivery status.
- Compare contracts/openapi.json before and after the refactor.
- If the contract changes unexpectedly, stop and investigate before release.

Phase 5 gate: no unexpected OpenAPI/database diff; all automated checks pass.

---

## 14. Phase 6 — Release hardening and sign-off

### 6.1 Clean build and migration verification

Run from a clean checkout or clean build workspace:

```sh
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm prisma:validate
pnpm prisma:deploy
pnpm lint
pnpm format
pnpm typecheck
pnpm test:all
pnpm build
pnpm openapi:validate
```

No migration should be generated by this refactor. If Prisma reports a schema
change, stop and review it against database-spec.md.

### 6.2 Smoke and release verification

- Run pnpm test:smoke against the target API with environment values supplied
  only by the shell/secret manager.
- Verify health, envelope, request ID, CORS, security headers, secure cookie
  behavior, and database connectivity.
- Run the release-candidate frontend E2E handoff from
  release-verification.md against a dedicated preview environment.
- Verify OAuth callbacks, verification email, password reset, refresh/logout
  CSRF behavior, export downloads, import replacement, and sign-out.

### 6.3 Sign-off criteria

Mark the refactor complete only when:

- all phases and micro-step gates are recorded as passing;
- no feature service/controller/route has direct Prisma access;
- all repositories enforce the documented ownership and transaction rules;
- existing integration tests pass without compatibility constructors;
- contracts/openapi.json is unchanged unless an approved contract change is
  separately released;
- Docker/runtime build and release smoke checks pass;
- rollback remains application-release-safe and no destructive migration was
  introduced.

---

## 15. Final completion checklist

- [ ] Phase 0 foundation remains intact.
- [ ] AuthService has no Prisma import, getter, or compatibility constructor.
- [ ] User profile/preferences persistence is owned by the users module.
- [ ] Connected-account persistence is behind an explicit repository boundary.
- [ ] Google/GitHub services contain no Prisma access.
- [ ] Applications and tags have repositories and controllers.
- [ ] Notes and interviews have repositories and controllers.
- [ ] Dashboard, export, import, and health have explicit read/transfer
      boundaries.
- [ ] Routes contain only middleware and controller mappings.
- [ ] Services contain policy/orchestration only.
- [ ] Repositories contain Prisma queries and transactions only.
- [ ] Test factories use dependency injection without compatibility fallbacks.
- [ ] Repository-boundary CI audit passes.
- [ ] Typecheck, lint, format, unit, integration, build, Prisma, and OpenAPI
      gates pass.
- [ ] Release smoke and frontend E2E handoff pass.
