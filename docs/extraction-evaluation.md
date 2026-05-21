# Design-intake extraction evaluation

Lightweight ground-truth checks for `POST /api/design-intake/extract`. Fixtures live in [`data/extraction-eval-fixtures.json`](../data/extraction-eval-fixtures.json); the runner compares API responses to expected paths and values.

This does **not** change extraction, scraping, or Claude behavior — it only validates output shape and quality signals.

## Prerequisites

1. Local dev server running at **http://localhost:3000**:
   ```bash
   npm run dev
   # or
   npm run dev:local
   ```
2. For best results, set `ANTHROPIC_API_KEY` in `.env.local` so responses use `scraper_plus_claude` instead of scrape-only fallbacks.
3. Network access to the fixture URLs (public HTTPS sites).

Optional: override the base URL:

```bash
DESIGN_INTAKE_API_URL=http://127.0.0.1:3000 npm run api:evaluate
```

## Run evaluation

```bash
npm run api:evaluate
```

Verbose full JSON per fixture:

```bash
npm run api:evaluate -- --verbose
```

Exit code **0** when every fixture passes all **required** checks; **1** if any required check fails or the request cannot reach the server.

**Nice-to-have** checks print `⚠` and do not fail the run.

## Fixture format

Each entry in `fixtures`:

| Field | Description |
| --- | --- |
| `name` | Short id (printed in summary) |
| `websiteUrl` | Passed to the extract API |
| `productCategory` | Optional intake hint |
| `components` | Optional string array |
| `stylePreference` | Optional style hint |
| `customerInstructions` | Optional extra hints |
| `expectedChecks` | Array of check objects |

### Check types

| `type` | Fields | Behavior |
| --- | --- | --- |
| `exact` | `path`, `expected` | Value at `path` equals `expected` (strict / JSON for objects) |
| `pathIncludes` | `path`, `substring` | String at `path` contains `substring` (case-insensitive) |
| `arrayIncludes` | `path`, `substring` | Some array element string contains `substring` |
| `exists` | `path` | Value is non-null and non-empty string |
| `countGte` | `path`, `min` | Array length or numeric value ≥ `min` |
| `logoCandidateSource` | `path`, `expected` | Exact match (e.g. `header-image`, `icon`) |
| `typographyStyleGuess` | `path`, `expected` | Exact `styleGuess` (e.g. `modern_sans`, `unknown`) |

### Severity

| `severity` | Effect |
| --- | --- |
| `required` (default) | Failure fails the script |
| `nice_to_have` | Failure prints warning only |

### Path syntax

Dot paths with optional indexes: `business.domain`, `brand.logoCandidates[0].source`, `metadata.pagesInspected`.

## Adding fixtures

1. Copy an existing fixture block in `data/extraction-eval-fixtures.json`.
2. Tune checks from a known-good `npm run api:test -- <url>` response.
3. Prefer **required** for contract invariants (e.g. `ok: true`, domain, logo count).
4. Use **nice_to_have** for Claude-dependent copy (e.g. specific service phrases).

See also [`test-sites.md`](./test-sites.md) for manual QA URLs and checklist.
