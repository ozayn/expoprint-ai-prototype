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

### 3. Comparison and scoring (later)

Compare generated fields to stored historical values. See `npm run eval:historical` and related scripts under `scripts/eval/`.

## Where to put real data

| Path | Committed? | Purpose |
| --- | --- | --- |
| `data/private/eval/*.csv` | **No** — entire `data/private/` is gitignored | Real Metabase exports |
| `data/eval/metabase_sample.example.csv` | Yes | Fake example rows for smoke tests |
| `data/eval/runs/` | `.gitkeep` only | JSONL run outputs |
| `data/eval/results/` | `.gitkeep` only | URL candidates, extraction summaries, scores |

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
