#!/usr/bin/env bash
# Point this repo at project hooks (.githooks/pre-push, commit-msg).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

chmod +x .githooks/pre-push .githooks/commit-msg scripts/check-partner-data-git.sh

git config core.hooksPath .githooks

echo "Git hooks enabled (core.hooksPath=.githooks)"
echo "  pre-push  — blocks partner / eval data from being pushed"
echo "  commit-msg — strips Cursor co-author trailers"
