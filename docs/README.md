# Tally API documentation

Maintained operational entry points:

- [Project setup and API overview](../README.md)
- [Deployment](deployment.md)
- [Isolated recruiter demo](demo.md)
- [Release verification](release-verification.md)
- [Recovery and rollback boundaries](recovery.md)
- [Testing and database isolation](testing.md)
- [Email and notifications](email-notifications.md)
- [API contracts](../contracts/README.md)
- [Authentication review](auth-system-review.md)

Design references describe intended behavior rather than verified release status:

- [Product requirements](prd.md)
- [Backend architecture](backend-spec.md)
- [Database model](database-spec.md)
- [Operations requirements](operations-spec.md)
- [Release checklist](definition-of-done.md)

[Implementation planning](backend-implementation-plan.md), [refactor planning](backend-refactor-plan.md), and [reconciliation](reconciliation-report.md) are historical snapshots.

The versioned OpenAPI artifact is `contracts/openapi.json`; the API serves it at `/api/v1/openapi.json` and Swagger UI at `/api/v1/docs`. Coordinate contract changes with the independently versioned frontend. Current execution evidence is maintained in the sibling frontend's metrics inventory, rather than duplicated here.
