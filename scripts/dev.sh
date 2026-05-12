#!/usr/bin/env bash
# ExpoPrint AI prototype — local Next.js dev (macOS-friendly)
set -e

echo "Starting ExpoPrint AI prototype…"

if [[ ! -d node_modules ]]; then
  echo "node_modules not found; running npm install…"
  npm install
fi

exec npm run dev
