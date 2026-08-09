# Documentation Reconciliation Report

## Job Application Tracker

**Review date:** 2026-08-09
**Documents reviewed:** 7 specifications, approximately 11,200 lines
**Result:** Internally reconciled

---

## Executive Finding

The seven original documents form a coherent Job Application Tracker product
set, but they were not fully implementation-safe as written. Several Must Have
flows had missing endpoints, payload fields, metric definitions, persistence
mappings, or release-test coverage. Those conflicts have been normalized across
the affected documents.

## Individual Recheck

### Product Requirements Document

Rechecked scope, priorities, functional IDs, user stories, flows, and release
criteria.

Resolved:

- Defined dashboard metrics and archive behavior.
- Added the time-zone requirement needed for “today” and overdue calculations.
- Made initial-note creation atomic with application creation.
- Clarified verification and post-auth redirect behavior.
- Preserved Kanban drag-and-drop as Should Have instead of an accidental MVP
  release gate.
- Promoted minimum CSRF protection for cookie-authenticated endpoints to Must
  Have.

### UI/UX Specification

Rechecked every public/protected screen, modal, state, responsive rule, and
acceptance criterion.

Resolved:

- Removed the impossible post-verification “continue to dashboard” path.
- Defined global search as a shortcut to canonical application search.
- Added a visible tag-management surface and time-zone preference.
- Required application selection in the global Add Interview flow.
- Moved optional status-note collection before the atomic status mutation.
- Made board controls conditional on the Should Have enhancement.
- Corrected offline copy so it does not promise persisted authenticated data.

### Frontend Specification

Rechecked routes, auth bootstrap, API hooks, query names, validation, theme,
PWA behavior, tests, and current Next.js conventions.

Resolved:

- Added the missing social callback route and provider-link mutation.
- Defined refresh-then-me bootstrap ordering.
- Standardized `appliedFrom`, `appliedTo`, and `includeArchived` query names.
- Added `initialNote`, salary cross-field validation, and calendar-date handling.
- Made the backend theme preference authoritative with localStorage as a render
  cache only.
- Defined raw export download handling.
- Replaced removed `next lint` and deprecated `middleware.ts` conventions with
  ESLint CLI and `proxy.ts` for Next.js 16+.
- Clarified that auth guards are client-side UX controls and backend
  authorization remains mandatory.

### Backend Specification

Rechecked all routes, request/response shapes, auth/token flows, ownership,
validation, security, export/import, and tests.

Resolved:

- Added an authenticated, user-bound provider-link start contract.
- Added note-content search without pagination-duplicating joins.
- Added atomic application/tag/initial-note/history creation.
- Replaced ambiguous follow-up counts with a dashboard structure that includes
  the lists required by UI.
- Defined active/scheduled/archive/time-zone metric semantics.
- Made JSON and CSV downloads explicit response-envelope exceptions.
- Defined one canonical portable backup/import shape and transactional replace
  behavior.
- Made allowed-origin plus requested-with checks mandatory for refresh/logout.
- Removed the unused refresh-token signing secret from the opaque-token model.
- Added canonical validation limits and Prisma 7 runtime guidance.

### Database Specification

Rechecked logical tables, Prisma schema, native types, constraints, indexes,
cascades, ownership, and query expectations.

Resolved:

- Added required `@map` mappings so the Prisma schema actually creates the
  documented snake_case columns used by custom SQL.
- Added explicit `Timestamptz(3)` and `Date` native types.
- Added the user IANA time-zone field.
- Enforced one account per provider per user for the MVP UI model.
- Strengthened note and currency constraints.
- Defined note-search pagination, status-rank sorting, deterministic tie-breaks,
  and dashboard predicates.
- Updated the generator/config contract for Prisma 7+.

### Operations Specification

Rechecked local setup, environment variables, CI order, migrations, deployment,
monitoring, backup, rollback, and release flow.

Resolved:

- Removed the unused refresh-token secret from every environment/CI/deployment
  list.
- Strengthened production email/OAuth configuration validation.
- Moved Prisma generation/migration before typecheck in clean CI.
- Replaced misleading “migration is idempotent” wording with Prisma migration
  history semantics.
- Made critical release-candidate E2E tests required while keeping per-PR E2E
  optional.
- Added the required CSRF deployment check.

### Definition of Done

Rechecked that every gate verifies an upstream requirement rather than creating
new scope.

Resolved:

- Added missing provider-link, note-search, time-zone, raw-download, CSRF, and
  database-mapping checks.
- Made notification persistence conditional because it is optional in the PRD.
- Made the Kanban section conditional because drag-and-drop is Should Have.
- Aligned OAuth/default-landing and verification-session expectations.
- Aligned E2E wording with the release-candidate requirement.

---

## Cross-document Contract Matrix

| Concern            | Canonical decision                                              | Documents synchronized                |
| ------------------ | --------------------------------------------------------------- | ------------------------------------- |
| Auth redirect      | Intended route, then saved landing preference                   | PRD, UI, frontend, DoD                |
| Provider linking   | Authenticated link start + user-bound one-time OAuth state      | PRD, UI, frontend, backend, DB, DoD   |
| Search             | Company, role, location, tags, and notes                        | PRD, UI, frontend, backend, DB, DoD   |
| Create application | Optional initial note and tags written atomically               | PRD, UI, frontend, backend, DoD       |
| Dashboard          | Archived excluded; active status set fixed; user time zone used | PRD, UI, backend, DB, DoD             |
| Query names        | `appliedFrom`, `appliedTo`, `includeArchived`                   | README, frontend, backend, DB         |
| Export/import      | Raw file downloads; versioned JSON; transactional replace       | Frontend, backend, operations, DoD    |
| Physical schema    | snake_case maps; timestamptz; applied date                      | Database, DoD                         |
| CSRF               | Origin + requested-with on cookie-auth endpoints                | README, PRD, backend, operations, DoD |
| Kanban             | Should Have; accessible menu required if shipped                | README, PRD, UI, frontend, DoD        |
| E2E                | Required for release candidate, optional per PR                 | README, frontend, operations, DoD     |

---

## Final Status

No internal specification conflict is known to block implementation of the Job
Application Tracker document set.
