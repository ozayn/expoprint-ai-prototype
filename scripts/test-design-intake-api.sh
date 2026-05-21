#!/usr/bin/env bash
# POST /api/design-intake/extract against local dev (http://localhost:3000).
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/test-design-intake-api.sh <websiteUrl> [productCategory] [stylePreference]

Examples:
  ./scripts/test-design-intake-api.sh https://expoprint.io
  npm run api:test -- https://expoprint.io
  npm run api:test -- https://stripe.com "Trade show booth" "Conservative"

Defaults:
  productCategory: Outdoor tent
  components: ["Canopy tent"]
  stylePreference: Modern

Requires local dev server at http://localhost:3000 (npm run dev or npm run dev:local).
USAGE
}

if [[ $# -lt 1 ]] || [[ -z "${1:-}" ]]; then
  usage >&2
  exit 1
fi

WEBSITE_URL="$1"
PRODUCT_CATEGORY="${2:-Outdoor tent}"
STYLE_PREFERENCE="${3:-Modern}"
API_URL="${DESIGN_INTAKE_API_URL:-http://localhost:3000/api/design-intake/extract}"

build_json_body() {
  if command -v jq >/dev/null 2>&1; then
    jq -n \
      --arg websiteUrl "$WEBSITE_URL" \
      --arg productCategory "$PRODUCT_CATEGORY" \
      --arg stylePreference "$STYLE_PREFERENCE" \
      --arg component "Canopy tent" \
      '{
        websiteUrl: $websiteUrl,
        productCategory: $productCategory,
        components: [$component],
        stylePreference: $stylePreference
      }'
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json, sys; print(json.dumps({
      "websiteUrl": sys.argv[1],
      "productCategory": sys.argv[2],
      "components": ["Canopy tent"],
      "stylePreference": sys.argv[3],
    }))' "$WEBSITE_URL" "$PRODUCT_CATEGORY" "$STYLE_PREFERENCE"
    return
  fi
  echo "error: need jq or python3 to build JSON request body" >&2
  exit 1
}

BODY="$(build_json_body)"

echo "POST $API_URL" >&2
echo "  websiteUrl: $WEBSITE_URL" >&2
echo "  productCategory: $PRODUCT_CATEGORY" >&2
echo "  stylePreference: $STYLE_PREFERENCE" >&2
echo "" >&2

RESPONSE="$(curl -sS -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$BODY")"

if command -v jq >/dev/null 2>&1; then
  echo "$RESPONSE" | jq .
else
  echo "$RESPONSE"
fi
