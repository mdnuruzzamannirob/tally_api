# Tally API Documentation

These files are tracked with the standalone API repository.

`contracts/openapi.json` is the versioned OpenAPI 3.1 artifact. The separate
web repository pins it for compatibility validation without sharing a workspace
package. The API exposes it at `/api/v1/openapi.json` and Swagger UI at
`/api/v1/docs`.

- `prd.md` — shared product requirements snapshot
- `backend-spec.md` — API architecture and endpoint contract
- `database-spec.md` — Prisma/PostgreSQL design
- `operations-spec.md` — API setup, CI, deployment, and operations
- `definition-of-done.md` — backend/database release checks
- `backend-implementation-plan.md` — phased API delivery plan
- `backend-refactor-plan.md` — phased migration of the implemented API to the final layered architecture
- `reconciliation-report.md` — prior cross-document consistency review
- `release-verification.md` — release smoke test, deployment sign-off, and frontend E2E handoff

When an API change affects the frontend contract, update the corresponding
contract details in the separate `web` repository in the same delivery.
