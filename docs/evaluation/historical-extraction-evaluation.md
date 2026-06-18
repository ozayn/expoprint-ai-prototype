# Historical extraction evaluation

This workflow is part of the **ExpoPrint AI prototype** repository — not a separate project. It uses historical design-service and project rows exported from Metabase to run ExpoPrint website extraction on partner URLs and **visually audit** extracted brand assets (logos, colors, business name).

**Partner feedback (2026):** The evaluation focus shifted from comparing ExpoPrint outputs field-by-field against database records toward visual review of brand extraction quality. Metabase fields provide source URLs and project context — they are not treated as ground-truth labels for every extracted field.

The workflow is **internal** and **local-first** (no Metabase connection, no production database credentials). Review at `/internal/eval` — local dev reads gitignored run outputs; deployed builds use password-protected published sanitized JSON only.

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

**Recommended:** run extraction and review queue generation in one step so `/internal/eval` always loads the review queue from that exact run:

```bash
npm run eval:extract-and-review -- data/eval/results/url_candidates_<timestamp>.csv --limit 10 --combine
```

This runs the same logic as `eval:extract`, then immediately builds `review_queue_<timestamp>.csv` from the JSONL path returned by that run (no guessing by newest file). Pass `--combine` to also merge all batch review queues into `review_queue_combined_<timestamp>.csv` and **publish** sanitized JSON to `data/eval/public/` for `/internal/eval` (review rows + URL inventory, domains included). Publishing runs automatically with `--combine`; pass `--no-publish` to skip. Use `--publish` to publish without combining. Publish does not commit or push — review `data/eval/public/*` manually.

By default, `eval:extract-and-review` selects only **not run** URLs — it skips sites already present in merged batch review queues. Failed and successful URLs are skipped unless you pass `--retry-failed` or `--reprocess`. Use `--reprocess-missing-colors` to reprocess only successful rows that have logos but no extracted palette (skips successful rows that already have colors). Failed rows are included only when `--retry-failed` is also passed. Eligible URLs are sorted **root/homepage first** (then shallow paths, then deep paths) before `--limit` and `--offset` are applied. Pass `--preserve-order` to keep inventory order. The script prints a selection summary before extraction.

```bash
npm run eval:extract-and-review -- data/eval/results/url_candidates_<timestamp>.csv --limit 10 --reprocess-missing-colors --combine
```

Each batch keeps its own timestamped `extraction_run_`, `extraction_summary_`, and `review_queue_` files (millisecond precision in ids avoids collisions). `/internal/eval` defaults to **Combined all batches** when a combined file exists and opens the **All URLs** tab when URL inventory is available (`?review=combined&view=inventory&sort=recent`); use **Latest batch** for the most recent extraction only.

To combine batches manually:

```bash
npm run eval:combine-reviews
```

You can still run the steps separately if needed:

```bash
npm run eval:extract -- data/eval/results/url_candidates_<timestamp>.csv --limit 5
npm run eval:review -- data/eval/runs/extraction_run_<timestamp>.jsonl
```

**Do not** run the full candidate list initially. A full run over ~2,000 URLs can take hours and may hit rate limits. Start with `--limit 5` or `--limit 10`, review `data/eval/results/extraction_summary_<timestamp>.csv`, then increase gradually.

**Batch large runs** with `--offset` and `--limit` so each batch is a separate run you can compare:

```bash
npm run eval:extract-and-review -- data/eval/results/url_candidates_<timestamp>.csv --limit 100 --offset 0
npm run eval:extract-and-review -- data/eval/results/url_candidates_<timestamp>.csv --limit 100 --offset 100
npm run eval:extract-and-review -- data/eval/results/url_candidates_<timestamp>.csv --limit 100 --offset 200
```

Each run writes `extraction_run_<timestamp>.jsonl`, `extraction_run_meta_<timestamp>.json` (batch label / run id), `extraction_summary_<timestamp>.csv`, and `review_queue_<timestamp>.csv` with matching timestamps for pairing.

Options:

| Flag | Default | Purpose |
| --- | --- | --- |
| `--limit N` | 10 | Max sites after domain dedupe |
| `--offset N` | 0 | Skip first N rows in the eligible pool (`eval:extract-and-review` defaults to not-run only) |
| `--allow-duplicate-domains` | off | One row per domain by default |
| `--delay-ms N` | 1000 | Pause between requests |
| `--api-url URL` | (in-process) | Optional: call a running dev server instead |
| `--retry-failed` | off | `eval:extract-and-review` only — include failed URLs from prior batches |
| `--reprocess` | off | `eval:extract-and-review` only — include successful URLs from prior batches |
| `--reprocess-missing-colors` | off | `eval:extract-and-review` only — reprocess successful rows with logo but no colors (plus not-run; failed only with `--retry-failed`) |
| `--reprocess-missing-palettes` | off | Alias for `--reprocess-missing-colors` |
| `--preserve-order` | off | `eval:extract-and-review` only — skip root URL prioritization |
| `--root-only` | off | `eval:extract-and-review` only — process only root/homepage URLs |
| `--combine` | off | `eval:extract-and-review` only — merge batch review queues; also publishes by default |
| `--snapshot` | off | `eval:extract-and-review` only — with `--combine`, write coverage benchmark snapshot |
| `--publish` | off | `eval:extract-and-review` only — publish `data/eval/public/*` (review + inventory) |
| `--no-publish` | off | `eval:extract-and-review` only — skip publish even with `--combine` |

#### Color / palette diagnostics

Audit color extraction from a JSONL run (writes gitignored `color_audit_<timestamp>.csv`):

```bash
npm run eval:audit-colors -- data/eval/runs/extraction_run_<timestamp>.jsonl
```

New extractions apply a **logo palette fallback** when Claude/HTML yields no colors but logo candidates exist (`palette_source: logo`, `palette_confidence: medium`). Existing explicit colors are never overwritten.

#### Coverage benchmark snapshots

Record aggregate field-coverage checkpoints for before/after progress tracking (no domains, URLs, or row-level partner data):

```bash
npm run eval:snapshot -- --latest-combined
npm run eval:snapshot -- data/eval/results/review_queue_combined_<timestamp>.csv --include-inventory
```

Appends to `data/eval/benchmarks/coverage_snapshots.json`. When a prior snapshot exists, the CLI prints percentage-point deltas (e.g. `Colors: 14% → 21% (+7 pts)` — not relative percent change).

Tracked fields: business name, logos, colors, emails, phones, social links, address, products/services, summary, plus scrape-depth distribution (0/unknown through 6+ pages).

Optional: `eval:extract-and-review --combine --snapshot` writes a snapshot after combine/publish. Snapshots are not automatic by default.

The `/progress` page shows the latest checkpoint and deltas when `coverage_snapshots.json` is present. See `data/eval/benchmarks/coverage_snapshots.example.json` for the schema. Commit aggregate snapshots only after review; `npm run check:partner-data` allowlists benchmark JSON.

Outputs (gitignored):

- `data/eval/runs/extraction_run_<timestamp>.jsonl` — full records including `expo_output` on success
- `data/eval/results/extraction_summary_<timestamp>.csv` — one row per site with status and key metrics

In-process extraction loads `.env.local` for `ANTHROPIC_API_KEY` when present. If in-process import fails, start `npm run dev` and pass `--api-url http://localhost:3000`.

#### Manual URLs (local development only)

When you want to test websites **outside** a Metabase export, use the **Add URLs** panel on `/internal/eval` while running `npm run dev` (not available in production builds).

1. Open `http://localhost:3000/internal/eval?review=combined&view=inventory&sort=recent` while `npm run dev` is running.
2. Click **Add URLs**, paste one URL per line (http/https; bare domains become `https://`), and optionally set a label/project title.
3. Click **Process URLs**. Up to **25** URLs per submission; invalid lines are reported without stopping the batch. A **1 second** delay runs between extraction requests.

The server runs the same in-process extraction pipeline as `eval:extract`, then builds a review queue via `eval:review` logic. Gitignored outputs:

- `data/eval/runs/manual_extraction_run_<timestamp>.jsonl`
- `data/eval/results/manual_extraction_summary_<timestamp>.csv`
- `data/eval/results/manual_review_queue_<timestamp>.csv`

Manual rows use `source_column = manual_url`, `ds_number` like `MANUAL-001`, and `project_title` from the optional label (or domain). The new run appears in the `/internal/eval` gallery/table file picker after refresh.

### 3. Review queue (Milestone 3b)

Build a side-by-side review CSV from an extraction JSONL run for manual scoring. When you use `eval:extract-and-review`, this step runs automatically on the JSONL from that extraction.

```bash
npm run eval:review -- data/eval/runs/extraction_run_<timestamp>.jsonl
```

Manual runs from the Add URLs panel use `manual_extraction_run_<timestamp>.jsonl` and write `manual_review_queue_<timestamp>.csv` with the same columns.

Writes `data/eval/results/review_queue_<timestamp>.csv` (or `manual_review_queue_<timestamp>.csv` for manual runs) with historical input fields, ExpoPrint output fields, logo/color audit columns (`selected_logo_url`, `logo_candidate_urls` as JSON, `extracted_color_hexes`, `primary_color_hex`, `secondary_color_hex`), optional manual score columns, and helper similarity hints. Full `expo_output` remains in the JSONL run file.

View at `/internal/eval?review=combined&view=inventory&sort=recent` — **All URLs** (default when inventory exists), **Gallery**, or **Extracted table**. All views share a field-coverage summary and expandable row details. In local dev, data comes from gitignored CSV/JSONL; in production, from published sanitized JSON only.

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

View score summaries locally at `/internal/eval` (compact section below the review tables).

### 5. Automated comparison (later)

See `npm run eval:historical` and `scoreHistoricalExtraction` for additional harness work.

## Evaluation viewers

Canonical route: **`/internal/eval`**. Legacy `/dev/eval` and `/eval-local` redirect there.

| Environment | Password | Data source |
| --- | --- | --- |
| Local dev (`NODE_ENV !== production`) | None | Gitignored `data/eval/runs/` and `results/` |
| Production | `EVAL_VIEWER_PASSWORD` | Published `data/eval/public/internal-eval-review.json` (or sample fallback) |

Production never reads `data/eval/runs/`, `data/eval/results/`, or `data/private/`. Local dev never requires a password.

### Publish sanitized data for `/internal/eval`

After building local review queues, publish an explicit sanitized JSON artifact for the deployed viewer.

**Recommended — combine all batches and publish review rows only:**

```bash
npm run eval:publish-latest-internal
```

This command:

1. Merges every `review_queue_<timestamp>.csv` batch into `review_queue_combined_<timestamp>.csv` (deduped by URL, newest wins).
2. Publishes that combined file to `data/eval/public/internal-eval-review.json` using the same sanitization as `eval:publish-internal`.
3. Defaults to `--include-domains` and includes logo URLs.
4. Runs `npm run check:partner-data` and prints a summary (combined path, row counts, logos/palettes/emails/phones/products counts).
5. Does **not** commit or push — you must inspect, commit, and push manually.

**Optional — also publish sanitized URL inventory for the All URLs tab:**

```bash
npm run eval:publish-latest-internal -- --include-url-inventory --include-domains
```

When `--include-url-inventory` is passed:

- Reads the largest real `url_candidates_*.csv` (same default as local `/internal/eval`), or `--url-candidates <file>` to override.
- Joins candidates with the published review rows by URL/domain.
- Writes `data/eval/public/internal-eval-url-inventory.json` (sanitized — no `ds_id`, requirement excerpts, or raw database text).
- `/internal/eval` shows the All URLs section only when this file exists in `data/eval/public/`.

**Warning:** publishing URL inventory exposes a list of source domains/URLs to anyone with the `/internal/eval` password. Omit `--include-url-inventory` unless you intend to share that list.

```bash
open data/eval/public/internal-eval-review.json
git add data/eval/public/internal-eval-review.json
# if inventory was published:
open data/eval/public/internal-eval-url-inventory.json
git add data/eval/public/internal-eval-url-inventory.json
git commit -m "Update internal eval dataset"
git push
```

**Manual publish** — when you want a specific review queue file (single batch or an existing combined file):

```bash
npm run eval:publish-internal -- data/eval/results/review_queue_<timestamp>.csv --include-domains
```

Writes `data/eval/public/internal-eval-review.json` with domains, extracted brand fields, logo URLs (optional), and colors — **no** `ds_id`, requirement excerpts, shop codes, or URL paths/queries.

| Command / flag | Default | Purpose |
| --- | --- | --- |
| `eval:publish-latest-internal` | — | Combine all batches + publish review rows (domains on by default) |
| `--include-url-inventory` | off | Also publish sanitized URL inventory JSON |
| `--include-project-context` | off | Include project titles in inventory |
| `--url-candidates <file>` | largest real file | Override url_candidates CSV for inventory |
| `--no-include-domains` | off | Site N / URL N labels instead of domains |
| `eval:publish-internal --include-domains` | off | Show canonical domains on manual publish |
| `--no-include-logo-urls` | off | Omit logo URLs; keep logo counts only |

**Review the JSON before commit.** This creates deployable artifacts. `npm run check:partner-data` allowlists only `data/eval/public/internal-eval-review.json` and `data/eval/public/internal-eval-url-inventory.json` (not raw CSV/JSONL).

If no published file exists, `/internal/eval` falls back to `data/eval/public-sample-review.json`.

## Where to put real data

| Path | Committed? | Purpose |
| --- | --- | --- |
| `data/private/eval/*.csv` | **No** — entire `data/private/` is gitignored | Real Metabase exports |
| `data/eval/metabase_sample.example.csv` | Yes | Fake example rows for smoke tests |
| `data/eval/runs/` | `.gitkeep` only | JSONL run outputs |
| `data/eval/results/` | `.gitkeep` only | URL candidates, extraction summaries, review queues |
| `data/eval/public-sample-review.json` | Yes | Built-in sample fallback for `/internal/eval` |
| `data/eval/public/internal-eval-review.json` | Yes (after publish) | Sanitized published rows for `/internal/eval` |
| `data/eval/public/internal-eval-url-inventory.json` | Yes (optional publish) | Sanitized URL inventory for `/internal/eval` All URLs tab |

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
