# Design-intake extraction API (prototype v1)

**Phase 1 milestone** — ExpoPrint integration endpoint (see also `/progress` Stage 20 and `docs/work-log.md`).

Stable integration-style endpoint for ExpoPrint’s downstream systems. The existing **`POST /api/analyze-website`** route remains for the editor (`/`) and guided demo (`/demo`) as **visual consumers and test harnesses**; this contract is normalized for machine consumption.

**Status:** First stable contract — **not** production-final. Human review is still required. No raw HTML or full scraped text is returned.

## Endpoint

```
POST /api/design-intake/extract
```

- **Runtime:** Node.js (server-only)
- **Auth:** None in prototype (deploy behind your gateway in production)
- **Secrets:** `ANTHROPIC_API_KEY` on the server only — never returned in responses

## Request

`Content-Type: application/json`

```json
{
  "websiteUrl": "https://expoprint.io",
  "productCategory": "Outdoor tent",
  "components": ["Canopy tent", "Back wall"],
  "stylePreference": "Modern",
  "customerInstructions": "Optional notes for the designer"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `websiteUrl` | Yes | Public `http` or `https` URL to analyze |
| `productCategory` | No | e.g. `Outdoor tent`, `Trade show booth` |
| `components` | No | Product surface labels (strings) |
| `stylePreference` | No | e.g. `Modern`, `Conservative` |
| `customerInstructions` | No | Free-text notes (capped) |

## Response sections (normalized JSON)

| Section | Contents |
|---------|----------|
| `business` | `name`, `website`, `domain`, `canonicalUrl` |
| `brand` | `colors[]`, `typography` (font families, style guess), `logoCandidates[]` |
| `content` | `services[]`, `products[]`, `contact` (phone, email, address, social[]) |
| `designIntake` | `productCategory`, `components`, `stylePreference`, `recommendedHeadline`, `recommendedSupportingText`, `missingAssets`, `confidenceNotes`, `needsHumanReview` |
| `metadata` | `source`, `pagesInspected`, `durationMs`, `websiteFetch`, `claude`, `warnings[]`, optional `quality` |

## Response (success)

`ok: true` when Claude returns usable structured fields **or** when the scraper produced partial useful data (logo candidates, typography, successful page fetch) even if Claude failed.

```json
{
  "ok": true,
  "business": {
    "name": "ExpoPrint",
    "website": "https://expoprint.io",
    "domain": "expoprint.io",
    "canonicalUrl": "https://expoprint.io/"
  },
  "brand": {
    "colors": ["#0B2E4A", "#2BB3A3"],
    "typography": {
      "fontFamilies": ["Inter"],
      "headingFontCandidates": [],
      "bodyFontCandidates": [],
      "googleFontFamilies": ["Inter"],
      "styleGuess": "modern_sans"
    },
    "logoCandidates": [
      {
        "url": "https://expoprint.io/logo.svg",
        "source": "header-image",
        "score": 120,
        "transparency": "likely_transparent"
      }
    ]
  },
  "content": {
    "services": ["Custom trade displays"],
    "products": ["Canopy tents"],
    "contact": {
      "phone": "",
      "email": "",
      "address": "",
      "social": ["linkedin.com/company/example"]
    }
  },
  "designIntake": {
    "productCategory": "Outdoor tent",
    "components": ["Canopy tent", "Back wall"],
    "stylePreference": "Modern",
    "recommendedHeadline": "ExpoPrint",
    "recommendedSupportingText": "Custom trade displays",
    "missingAssets": ["Production-quality logo upload still recommended"],
    "confidenceNotes": [
      "Prototype extraction — not print-ready artwork.",
      "Logo candidates require human confirmation before production."
    ],
    "needsHumanReview": true
  },
  "metadata": {
    "source": "scraper_plus_claude",
    "pagesInspected": 2,
    "durationMs": 8400,
    "websiteFetch": { "status": "success", "pagesFetched": 2 },
    "claude": { "attempted": true, "model": "claude-3-5-sonnet-latest", "status": "success" },
    "warnings": []
  }
}
```

## Response (failure)

`ok: false` when the request is invalid or neither Claude nor the scraper produced useful partial data. Partial sections may still be present for debugging.

HTTP **400** for invalid JSON or missing `websiteUrl`. HTTP **200** with `ok: false` for pipeline failures (same pattern as `/api/analyze-website`).

## What the scraper does (traditional)

- Fetches the **homepage** plus up to **three** same-origin linked pages (about / services / contact-style heuristics).
- **No** full-site crawl, sitemap follow, or headless browser.
- Parses HTML for title/meta/OG, mailto/tel/social links, logo image candidates, typography hints (inline CSS, `<style>`, Google Fonts links, limited same-origin CSS).
- **Does not** return raw HTML or full-page text in the API JSON.

## What Claude does

- Receives capped text excerpts and scrape metadata (server-side only).
- Returns structured fields: services, products, contact strings, brand colors, business name hints.
- Services/products strings are normalized (cleanup, dedupe, caps) before appearing in `content.*` arrays.

## Limitations

- Not a production-final API; schema may evolve.
- Not print-ready artwork or exact font matching.
- Logo candidates are **candidates only** — human confirmation required.
- Production-quality logo upload is still recommended.
- `needsHumanReview` is always `true` in v1.
- Missing `ANTHROPIC_API_KEY` → Claude skipped; response may be `ok: true` with `metadata.source: "scraper_only"` when scrape data exists.

## Local test script

With the dev server running (`npm run dev`):

```bash
npm run api:test -- https://expoprint.io
npm run api:test -- https://stripe.com "Trade show booth" "Conservative"
```

Or run the script directly:

```bash
./scripts/test-design-intake-api.sh https://expoprint.io
```

Arguments: `websiteUrl` (required), `productCategory` (default `Outdoor tent`), `stylePreference` (default `Modern`). Sends `components: ["Canopy tent"]`. Pretty-prints with `jq` when installed; otherwise prints raw JSON.

Override the endpoint with `DESIGN_INTAKE_API_URL` (optional).

## Example: curl

```bash
curl -sS -X POST "http://localhost:3000/api/design-intake/extract" \
  -H "Content-Type: application/json" \
  -d '{
    "websiteUrl": "https://expoprint.io",
    "productCategory": "Outdoor tent",
    "components": ["Canopy tent"],
    "stylePreference": "Modern",
    "customerInstructions": ""
  }' | jq '.ok, .business.name, .metadata.source, .metadata.warnings'
```

## Related routes

| Route | Purpose |
|-------|---------|
| `POST /api/analyze-website` | UI-oriented analyze (fills editor/demo intake) |
| `GET /api/proxy-image` | Safe logo preview for Fabric canvas (demo only) |

## Implementation files

- `src/app/api/design-intake/extract/route.ts`
- `src/lib/designIntakeApiSchema.ts`
- `src/lib/buildDesignIntakeApiResponse.ts`
- `src/lib/server/claudeWebsiteAnalyze.ts` (shared scrape + Claude pipeline)
