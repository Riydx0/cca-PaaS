#!/bin/sh
set -e

echo "[cca-PaaS] Running database migrations..."
cd /app
pnpm --filter @workspace/db run push-force

echo "[cca-PaaS] Starting API server..."
exec node --enable-source-maps /app/artifacts/api-server/dist/index.mjs
