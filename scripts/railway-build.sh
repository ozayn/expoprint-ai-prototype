#!/usr/bin/env bash
# Lean production build for Railway (Railpack / Nixpacks). Keeps peak disk lower than a full Docker layer cache.
set -euo pipefail

echo "==> Railway build: install dependencies"
# Do not use --omit=optional: Tailwind/lightningcss needs platform-native optional deps.
npm ci --no-audit --no-fund
npm cache clean --force

echo "==> Railway build: next build (standalone)"
export NEXT_TELEMETRY_DISABLED=1
npm run build

echo "==> Railway build: stage standalone assets"
cp -r public .next/standalone/
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/

echo "==> Railway build: prune dev dependencies"
npm prune --omit=dev
rm -rf .next/cache node_modules/.cache
npm cache clean --force

echo "==> Railway build: done"
