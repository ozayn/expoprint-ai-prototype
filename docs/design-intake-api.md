# Design-intake extraction API (prototype v1)

**Phase 1 milestone** — ExpoPrint integration endpoint (see also `/progress` Stage 20 and `docs/work-log.md`).

Stable integration-style endpoint for ExpoPrint’s downstream systems. The existing **`POST /api/analyze-website`** route remains for the editor (`/`) and guided demo (`/demo`) as **visual consumers and test harnesses**; this contract is normalized for machine consumption.

Both routes call the **same server pipeline** (`runClaudeWebsiteAnalyze` in `src/lib/server/claudeWebsiteAnalyze.ts`), which runs bounded multi-page scraping (`extractWebsiteContent`), logo candidate ranking, typography extraction, and optional Claude interpretation. Only the **response shape** differs: integration JSON here vs. UI-oriented `extracted` rows on `/api/analyze-website`.

**Status:** First stable contract — **not** production-final. Human review is still required. No raw HTML or full scraped text is returned.

## Shared extraction pipeline

| Stage | Module | Used by both routes? |
|-------|--------|----------------------|
| Multi-page scrape, logo URLs, typography from HTML/CSS | `src/lib/server/extractWebsiteContent.ts` | Yes |
| Logo rank/filter for UI list | `src/lib/logoCandidateRanking.ts`, `prepareLogoCandidatesForUi.ts` | Yes (in scrape) |
| Claude structured fields | `src/lib/server/claudeWebsiteAnalyze.ts` | Yes |
| Integration JSON (`business`, `brand`, `content`, …) | `src/lib/buildDesignIntakeApiResponse.ts` | **`/api/design-intake/extract` only** |
| UI intake merge | `src/lib/analyzeWebsiteSuggestions.ts` (client) | **`/api/analyze-website` only** |

**Test surfaces**

| Surface | Route |
|---------|--------|
| `npm run api:test`, `npm run api:evaluate`, `/api-test` | `POST /api/design-intake/extract` |
| Home editor `/`, guided `/demo` | `POST /api/analyze-website` |

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

### Large pages (partial HTML extraction)

Homepage HTML is capped at **800 KB** per GET (unchanged). When `Content-Length` or the streamed body exceeds that cap, the server **keeps the first 800 KB** and parses it (title, meta/OG, logo candidates, mailto/tel/social, capped visible text). Raw HTML is never returned.

| `metadata.websiteFetch` | Meaning |
| --- | --- |
| `status: "success"` | Full page within cap |
| `status: "partial"` | Homepage truncated; `reason: "body_truncated"` |
| `status: "failed"` | No usable HTML (HTTP error, timeout, non-HTML, empty body) |

Warning code: `large_site_partial_extraction` (also a human-readable line in `metadata.warnings`). Useful for heavy retail sites (e.g. `cvs.com`) where the full homepage is multi‑MB but head metadata is still in the first chunk. Partial pages may still yield `cvs-logo.svg` from JSON-LD/OG in the truncated head; favicon-only sites emit `favicon_only_logo_candidate` and `Production-quality logo upload recommended` in `missingAssets`.

**Editor vs extract:** both routes call the same pipeline. The UI sends the placeholder business name (`Example Brand Co.`); the server ignores Claude echoes of that placeholder and resolves the public name from title/OG/domain like the integration API. Use `npm run api:compare -- cvs.com` to verify matching fetch metadata.

## Compare UI vs integration routes (same pipeline)

With the dev server running, compare both endpoints for the same URL (e.g. bare `google.com`):

```bash
npm run api:compare -- google.com
# or
./scripts/compare-analyze-api-routes.sh google.com
```

Manual curls:

```bash
curl -sS -X POST "http://localhost:3000/api/analyze-website" \
  -H "Content-Type: application/json" \
  -d '{"websiteUrl":"google.com","businessName":"Example Brand Co.","productCategory":"Trade show booth","style":"Modern"}' \
  | jq '{ok,source,reason,suggestedBusinessName,websiteFetch}'

curl -sS -X POST "http://localhost:3000/api/design-intake/extract" \
  -H "Content-Type: application/json" \
  -d '{"websiteUrl":"google.com","productCategory":"Trade show booth","components":["Backdrop"],"stylePreference":"Modern"}' \
  | jq '{ok,business:.business.name,source:.metadata.source,warnings:.metadata.warnings,websiteFetch:.metadata.websiteFetch}'
```

Expect matching `pagesFetched`, logo counts, and business name (integration uses `resolveBusinessName`; analyze-website returns the same resolved `suggestedBusinessName`).

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
| `POST /api/design-intake/extract` | Integration API — normalized JSON (this document) |
| `POST /api/analyze-website` | UI/demo analyze — same pipeline, `extracted` rows + `websiteFetch` metadata |
| `GET /api/proxy-image` | Safe logo preview for Fabric canvas (not part of extraction) |

## Implementation files

- `src/app/api/design-intake/extract/route.ts`
- `src/lib/designIntakeApiSchema.ts`
- `src/lib/buildDesignIntakeApiResponse.ts`
- `src/lib/server/claudeWebsiteAnalyze.ts` (shared scrape + Claude pipeline)
