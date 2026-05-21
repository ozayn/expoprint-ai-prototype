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

Repeat each fixture to spot inconsistent runs (e.g. missing business name on some attempts):

```bash
npm run api:evaluate -- --runs 3
```

With `--runs N`, **required** checks must pass on **every** run. Partial pass rates are reported as flaky. **Nice-to-have** checks warn but do not fail the script.

Exit code **0** when every fixture passes all **required** checks on all runs; **1** if any required check fails, is flaky, or the request cannot reach the server.

## API reliability signals

Extract responses now include additive debug fields (backwards-compatible):

| Field | Purpose |
| --- | --- |
| `metadata.quality` | `high` / `medium` / `low` for `businessName`, `logo`, `servicesProducts`, `overall` |
| `metadata.warnings` | Human-readable lines plus machine codes such as `missing_business_name`, `website_fetch_failed`, `claude_failed_or_skipped`, `business_name_inferred_from_domain`, `large_site_partial_extraction` |

Business names use deterministic fallbacks when Claude omits a name: Claude suggestion → brand-like title/og:title → cautious domain label.

### Partial extraction (large homepages)

If a fixture URL serves a homepage larger than the HTML byte cap (~800 KB), expect `metadata.websiteFetch.status` of `"partial"` and `reason` `"body_truncated"`, with warning `large_site_partial_extraction`. Title, logos, and contact links may still pass **required** checks when present in the truncated head of the document. Manual smoke URL: `https://www.cvs.com` (or `cvs.com`).

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
| `anyArrayIncludes` | `paths`, `substring` and/or `substrings` | On any listed path, some array element contains `substring` or any entry in `substrings` (case-insensitive) |
| `exists` | `path` | Value is non-null and non-empty string |
| `countGte` | `path`, `min` | Array length or numeric value ≥ `min` |
| `logoCandidateSource` | `path`, `expected` | Exact match (e.g. `header-image`, `icon`) |
| `typographyStyleGuess` | `path`, `expected` | Exact `styleGuess` (e.g. `modern_sans`, `unknown`) |
| `pathIn` | `path`, `expected` (array) | String at `path` is one of the allowed values |

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

## Current fixture set (v1)

| Fixture | URL | Focus |
| --- | --- | --- |
| `expoprint-baseline` | https://expoprint.io | Internal baseline, header logo, services |
| `google-logo-ranking` | https://www.google.com | Logo ranking, multi-page |
| `stripe-b2b-saas` | https://stripe.com | B2B SaaS, favicon-class logo |
| `shopify-ecommerce-saas` | https://www.shopify.com | Ecommerce / commerce vocabulary |
| `mailchimp-marketing-saas` | https://mailchimp.com | Marketing brand, playful SaaS |
| `patagonia-consumer-brand` | https://www.patagonia.com | Consumer brand, bot-wall / logo stress |
| `cvs-large-site-partial` | https://www.cvs.com | Partial HTML (`body_truncated`) |
| `warby-parker-blocked-fetch` | https://www.warbyparker.com | Static fetch blocked (`http_403`), low quality |

Newer fixtures intentionally avoid exact logo URLs and Claude-specific copy in **required** checks. Use **nice_to_have** for service/product phrases, typography, and warning codes.

For terms that may appear in either `content.services` or `content.products` (or under synonyms like “automations” vs “automation”), prefer `anyArrayIncludes` with multiple `substrings` rather than many narrow `arrayIncludes` checks.
