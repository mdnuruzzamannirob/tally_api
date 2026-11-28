# Release recovery and local verification

The Phase D rehearsal used disposable PostgreSQL 16 fixtures and a clean-built
Node 20 runtime image. It did not deploy to a hosted environment or test a
provider-managed backup service.

## Before a release

Record the source revision, image identifier, migration set, required environment
variables, and previous deployable image. Run the checks in
[release verification](release-verification.md). The build uses a dummy database
URL for Prisma generation; real runtime and migration credentials are injected
separately. Never bake private environment files into an image.

Apply migrations before starting the new runtime. Verify `/api/v1/health` reports
database connectivity, request-ID correlation, allowed CORS origin, and expected
security headers. A healthy process alone does not verify email, OAuth, or a user
journey. Those require checks on the actual deployed origins.

The application currently trusts one proxy hop. The deployment ingress must
match that assumption and sanitize forwarding headers. Shared authentication
limits use PostgreSQL in production; the global API limiter remains per-process.

## Backup and restore rehearsal

Use PostgreSQL tools matched to the server version. Supply connection settings
through `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, and a scoped secret source;
do not paste a credential-bearing connection URL into logs.

```sh
pg_dump --format=custom --file=backup.dump
createdb "$RESTORE_DATABASE"
PGDATABASE="$RESTORE_DATABASE" pg_restore --no-owner --no-privileges backup.dump
```

`RESTORE_DATABASE` must name a new isolated target. Confirm the target before
running commands. Compare schema/migrations, table row counts, representative
records, foreign-key relationships, and application behavior before considering
promotion. The automated local rehearsal compared every public table's count
and deterministic row-data digest, including migration records, after restoring
to a separate database. The temporary dump was removed afterward.

Keep notification workers disabled while validating a restore. Review pending
jobs before enabling delivery, because restored jobs can have ambiguous delivery
history. Real backup retention, access permissions, off-site copies, encryption,
and point-in-time recovery remain deployment-owner responsibilities; they were
not established by this local restore test.

## Rollback

An application rollback can reuse a previous image only when the current schema
is compatible with it. Do not assume migrations can be reversed automatically.
For an incompatible migration, choose a tested forward fix or restore procedure
and evaluate data written since the backup. The Phase D rehearsal verified image
startup and database restoration, not a production version rollback.

## Diagnostics

Request IDs connect request/error events. The logger redacts authorization,
cookies, request bodies/query strings, callback locations, and error details.
The production error handler omits raw stacks. Tests exercise the redaction
configuration; deployed log sampling remains a release check.

See [email/notification behavior](email-notifications.md) for retry and duplicate
delivery limits, and [deployment](deployment.md) for migration/runtime ordering.
