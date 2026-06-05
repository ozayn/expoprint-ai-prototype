# Historical extraction evaluation

This workflow is part of the **ExpoPrint AI prototype** repository — not a separate project. It uses historical design-service and project rows exported from Metabase to evaluate how well ExpoPrint website extraction matches real partner work already stored in ExpoPrint systems.

The workflow is **internal**, **local-only**, and **scripts-only** (no Metabase connection, no production database credentials, no new API routes, no UI).

## Milestones

### 1. URL candidate extraction

Historical Metabase exports often **do not** include a clean `website_url` column. URLs appear inside requirement text (`first_req_description`, `first_req_note`) or occasionally in `project_title`, plus optional direct URL columns when present.

```bash
npm run eval:urls -- data/private/eval/basic_design_service_query_2026-06-04.csv
```

This writes `data/eval/results/url_candidates_<timestamp>.csv` — one row per discovered URL, with `source_column`, `raw_url`, `normalized_url`, and `domain`.

**No website scraping** runs in this step.

### 2. Limited website extraction

Run the same design-intake extraction pipeline as `POST /api/design-intake/extract` on a **small sample** from a URL candidates file.

```bash
npm run eval:extract -- data/eval/results/url_candidates_<timestamp>.csv --limit 5
```

**Do not** run the full candidate list initially — thousands of domains would take hours and hit rate limits. Start with `--limit 5` or `--limit 10`, review `data/eval/results/extraction_summary_<timestamp>.csv`, then increase gradually.

Options:

| Flag | Default | Purpose |
| --- | --- | --- |
| `--limit N` | 10 | Max sites after domain dedupe |
| `--offset N` | 0 | Skip first N unique domains |
| `--allow-duplicate-domains` | off | One row per domain by default |
| `--delay-ms N` | 1000 | Pause between requests |
| `--api-url URL` | (in-process) | Optional: call a running dev server instead |

Outputs (gitignored):

- `data/eval/runs/extraction_run_<timestamp>.jsonl` — full records including `expo_output` on success
- `data/eval/results/extraction_summary_<timestamp>.csv` — one row per site with status and key metrics

In-process extraction loads `.env.local` for `ANTHROPIC_API_KEY` when present. If in-process import fails, start `npm run dev` and pass `--api-url http://localhost:3000`.

### 3. Review queue (Milestone 3b)

Build a side-by-side review CSV from an extraction JSONL run for manual scoring.

```bash
npm run eval:review -- data/eval/runs/extraction_run_<timestamp>.jsonl
```

Writes `data/eval/results/review_queue_<timestamp>.csv` with historical input fields, ExpoPrint output fields, blank score columns (`business_name_score`, `category_score`, `logo_score`, `brief_score`, `overall_score`, `reviewer_notes`), and helper similarity hints.

View locally at `/dev/eval` (development only) or on deployed builds at `/internal/eval` (password + sample data only).

**Scoring rubric** (assign in CSV or spreadsheet):

| Score | Meaning |
| --- | --- |
| **3** | Correct / usable as-is |
| **2** | Mostly correct / minor edit |
| **1** | Partially useful / major edit |
| **0** | Wrong or missing |
| **N/A** | Not available or not applicable |

### 4. Score summary (Milestone 4)

After manually filling score columns in a review queue CSV, summarize results:

```bash
npm run eval:score -- data/eval/results/review_queue_<timestamp>.csv
```

Writes gitignored outputs:

- `data/eval/results/score_summary_<timestamp>.csv` — metric/distribution table
- `data/eval/results/score_summary_<timestamp>.json` — structured summary (omit with `--csv-only`)

The script validates scores (`0`, `1`, `2`, `3`, `N/A`, or blank). Invalid values print warnings; pass `--strict` to fail. The input review queue CSV is never modified.

View score summaries locally at `/dev/eval` (compact section below the review tables).

### 5. Automated comparison (later)

See `npm run eval:historical` and `scoreHistoricalExtraction` for additional harness work.

## Evaluation viewers

| Route | When | Data source |
| --- | --- | --- |
| **`/dev/eval`** | `NODE_ENV === development` only | Local gitignored `data/eval/runs/` and `results/` |
| **`/internal/eval`** | Deployed builds | Password (`EVAL_VIEWER_PASSWORD`) + committed `data/eval/public-sample-review.json` |

`/dev/eval` never reads partner files in production. `/internal/eval` reads only the sanitized sample JSON fixture — never `data/eval/runs/`, `data/eval/results/`, or `data/private/`. Private storage can be wired in later without changing the local workflow.

## Where to put real data

| Path | Committed? | Purpose |
| --- | --- | --- |
| `data/private/eval/*.csv` | **No** — entire `data/private/` is gitignored | Real Metabase exports |
| `data/eval/metabase_sample.example.csv` | Yes | Fake example rows for smoke tests |
| `data/eval/runs/` | `.gitkeep` only | JSONL run outputs |
| `data/eval/results/` | `.gitkeep` only | URL candidates, extraction summaries, review queues |
| `data/eval/public-sample-review.json` | Yes | Sanitized review rows for `/internal/eval` only |

Never commit partner CSVs, run outputs, or `*.local.csv` files.

**Git safety:** `.gitignore` covers these paths. Run `npm run check:partner-data` before pushing, and `./scripts/install-git-hooks.sh` once per clone to enable a **pre-push** guard.

## URL extraction rules

- Scan text columns: `first_req_description`, `first_req_note`, `project_title`
- Scan direct columns when present: `website_url`, `url`, `shop_url`, `customer_url`, `domain`
- Extract `http://` and `https://` URLs from text
- Extract conservative bare domains from text (`www.example.org`, `example.net`) — not emails, not file extensions like `.pdf`
- Normalize: trim, strip trailing punctuation, lowercase hostname, bare domains → `https://<domain>`
- Deduplicate: one row per `ds_id` / `ds_number` + `normalized_url` (merge `source_column` with `;` when the same URL appears in multiple fields)
- Console summary: rows read, rows with/without URLs, candidate count, unique domains, counts by source column

## Scoring rubric (comparison phase)

| Score | Meaning |
| --- | --- |
| **3** | Correct / usable as-is |
| **2** | Mostly correct / minor edit |
| **1** | Partially useful / major edit |
| **0** | Wrong or missing |
| **N/A** | Not available or not applicable |

Automated scoring marks semantic fields as `review` until a human assigns 0–3 or N/A.

## Related commands

```bash
# Example smoke test (URL candidates only)
npm run eval:urls -- data/eval/metabase_sample.example.csv

# Limited extraction sample (after eval:urls on real or example data)
npm run eval:extract -- data/eval/results/url_candidates_<timestamp>.csv --limit 5

# Review queue from extraction run
npm run eval:review -- data/eval/runs/extraction_run_<timestamp>.jsonl

# Normalize Metabase rows (URL column heuristics)
npx tsx scripts/eval/normalizeMetabaseRows.ts --input data/eval/metabase_sample.example.csv

# Full extract + score harness (requires dev server unless --dry-run)
npm run eval:historical
```

## Related docs

- Live fixture evaluation: [`docs/extraction-evaluation.md`](../extraction-evaluation.md)
- Integration contract: [`docs/design-intake-api.md`](../design-intake-api.md)
- Local data README: [`data/eval/README.md`](../../data/eval/README.md)

## What this does not do

- No Metabase or production DB access
- No changes to the integration API response schema
- No deployment changes
