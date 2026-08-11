# Tally API contracts

- `openapi.json` is the authoritative OpenAPI 3.1 contract served at `/api/v1/openapi.json`.
- `tally.postman.json` is the import-ready Postman Collection v2.1 file.

Run `pnpm contracts:generate` after changing the route manifest, then run
`pnpm contracts:validate`.

In Postman, import the collection JSON, confirm `baseUrl`, then run requests in numbered folder
order. Login and create requests automatically save the access token and generated resource IDs.
Postman stores the `tally_rt` refresh cookie in its cookie jar.
