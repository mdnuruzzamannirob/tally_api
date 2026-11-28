# Tally API contracts

- `openapi.json` is the authoritative OpenAPI 3.1 contract served at `/api/v1/openapi.json`.
- `tally.postman.json` is the import-ready Postman Collection v2.1 file.

Run `pnpm contracts:generate` after changing the route manifest. The single generator updates
both JSON artifacts. Then run `pnpm contracts:validate`.

In Postman, import the collection JSON, confirm `baseUrl`, then run requests in numbered folder
order. Login and create requests automatically save the access token and generated resource IDs.
Postman stores the `tally_rt` refresh cookie in its cookie jar.

`startDemo` and `resetDemo` are available only with `DEMO_MODE=true`; normal
deployments return 404. Set `webAppUrl` to the configured frontend origin and
send the generated Origin / X-Requested-With headers. Demo entry returns the
same session shape as login. See [demo operations](../docs/demo.md).

The local collection default is `http://localhost:5000/api/v1`. The documented
dashboard endpoint is `GET /dashboard`; `GET /dashboard/summary` remains a
compatible alias.
