# API Test Guide

Use a dedicated PostgreSQL database for every integration test run. Set
`TEST_DATABASE_URL` through your environment or secret manager; do not place
connection credentials in source files.

Run fast non-database checks:

```sh
pnpm test:unit
```

Run the database-backed integration suite after applying migrations to the
dedicated test database:

```sh
pnpm prisma:deploy
pnpm test:integration
```

`test:integration` fails immediately when `TEST_DATABASE_URL` is absent, so
database tests cannot be silently skipped. Run both suites with:

```sh
pnpm test:all
```
