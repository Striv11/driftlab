#!/usr/bin/env bash
# Single quality gate used by CI and by build-lab before every push:
# format check, lint, typecheck, tests, build.
set -euo pipefail
cd "$(dirname "$0")"
npm ci --no-audit --no-fund
npx prettier --check .
npx eslint .
npx tsc --noEmit
npx vitest run
npx vite build
