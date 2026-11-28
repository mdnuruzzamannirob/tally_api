#!/usr/bin/env bash
# Local verification only. Database integration tests need an isolated database.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
pnpm env:check:production
pnpm lint
pnpm typecheck
pnpm db:validate
pnpm test:unit
pnpm contracts:validate
pnpm format
pnpm build
printf '%s\n' 'Local API checks passed. Run isolated integration tests and deployed smoke checks before release.'
