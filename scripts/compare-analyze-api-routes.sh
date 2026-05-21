#!/usr/bin/env bash
# Compare POST /api/analyze-website vs /api/design-intake/extract for the same URL.
# Requires local dev server at http://localhost:3000.
set -euo pipefail

URL="${1:-google.com}"
BASE="${API_BASE_URL:-http://localhost:3000}"

summarize() {
  node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
const wf=d.websiteFetch||d.metadata?.websiteFetch||{};
const name=d.suggestedBusinessName||d.business?.name||'';
console.log(JSON.stringify({
  ok:d.ok,
  source:d.source||d.metadata?.source,
  reason:d.reason,
  businessName:name,
  domain:d.suggestedWebsiteDomain||d.business?.domain,
  pages:wf.pagesFetched,
  textChars:wf.textChars,
  logoCandidates:wf.logoCandidates??wf.logoCandidatesList?.length,
  claude:d.claudeAttempted??d.metadata?.claude?.attempted,
},null,2));
"
}

echo "URL: $URL"
echo ""

echo "=== POST /api/analyze-website ==="
curl -sS -X POST "$BASE/api/analyze-website" \
  -H "Content-Type: application/json" \
  -d "{\"websiteUrl\":\"$URL\",\"businessName\":\"Example Brand Co.\",\"productCategory\":\"Trade show booth\",\"style\":\"Modern\"}" \
  | summarize

echo ""
echo "=== POST /api/design-intake/extract ==="
curl -sS -X POST "$BASE/api/design-intake/extract" \
  -H "Content-Type: application/json" \
  -d "{\"websiteUrl\":\"$URL\",\"productCategory\":\"Trade show booth\",\"components\":[\"Backdrop\"],\"stylePreference\":\"Modern\"}" \
  | summarize
