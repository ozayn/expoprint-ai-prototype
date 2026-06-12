# Historical evaluation data (local only)

Part of the ExpoPrint AI prototype — not a separate repo.

## Private partner exports

Place real Metabase CSV exports here (gitignored):

```text
data/private/eval/basic_design_service_query_2026-06-04.csv
```

The entire `data/private/` tree must never be committed or pushed.

### Git safety

| Layer | What it does |
| --- | --- |
| `.gitignore` | Ignores `data/private/`, eval runs/results, URL candidate CSVs, extraction JSONL, Metabase export name patterns |
| `npm run check:partner-data` | Fails if forbidden paths are staged or tracked |
| `./scripts/install-git-hooks.sh` | Enables **pre-push** hook that blocks pushes containing partner/eval files |

```bash
./scripts/install-git-hooks.sh
npm run check:partner-data
```

Only the fake example `metabase_sample.example.csv` is meant to be committed under `data/eval/`.

## Tracked example

`metabase_sample.example.csv` — fake rows for script smoke tests.

## Outputs

| Folder | Contents |
| --- | --- |
| `runs/` | `extraction_run_*.jsonl` (gitignored) |
| `results/` | `url_candidates_*.csv`, `extraction_summary_*.csv`, `review_queue_*.csv`, `score_summary_*` (gitignored) |

## URL candidates

```bash
npm run eval:urls -- data/private/eval/basic_design_service_query_2026-06-04.csv
npm run eval:urls -- data/eval/metabase_sample.example.csv
```

## Limited website extraction

After `eval:urls`, run a small sample only. A full ~2k URL run can take hours and hit rate limits — batch with `--limit` and `--offset`:

```bash
# Recommended: extraction + review queue in one command (--combine merges all batches)
npm run eval:extract-and-review -- data/eval/results/url_candidates_<timestamp>.csv --limit 5 --combine
npm run eval:combine-reviews

# Or separate steps
npm run eval:extract -- data/eval/results/url_candidates_<timestamp>.csv --limit 5
npm run eval:extract -- data/eval/results/url_candidates_<timestamp>.csv --limit 100 --offset 0
npm run eval:extract -- data/eval/results/url_candidates_<timestamp>.csv --limit 100 --offset 100
npm run eval:review -- data/eval/runs/extraction_run_<timestamp>.jsonl
npm run eval:score -- data/eval/results/review_queue_<timestamp>.csv
```

Each extraction run also writes `extraction_run_meta_<timestamp>.json` with `run_id`, batch offset/limit, and output paths for comparing batches.

See [`docs/evaluation/historical-extraction-evaluation.md`](../docs/evaluation/historical-extraction-evaluation.md).

## Viewers

| Route | Environment | Data |
| --- | --- | --- |
| [`/dev/eval`](http://localhost:3000/dev/eval) | Local dev only (`npm run dev`) | Gitignored `data/eval/runs/` + `results/` |
| [`/internal/eval`](http://localhost:3000/internal/eval) | Deployed (password) | `data/eval/public/internal-eval-review.json` (or sample fallback) |

### Publish for deployed viewer

**One command (recommended)** — combine all local batch review queues and publish sanitized JSON for `/internal/eval`:

```bash
npm run eval:publish-latest-internal
```

This runs `eval:combine-reviews`, publishes the new `review_queue_combined_<timestamp>.csv` with domains included by default, writes `data/eval/public/internal-eval-review.json`, and runs `check:partner-data`. It does **not** commit or push.

**Review rows + URL inventory** (optional — exposes the full candidate URL list to anyone with the `/internal/eval` password):

```bash
npm run eval:publish-latest-internal -- --include-url-inventory --include-domains
```

Also writes `data/eval/public/internal-eval-url-inventory.json` for the All URLs tab. Omit `--include-url-inventory` by default so URL lists are not published accidentally.

```bash
open data/eval/public/internal-eval-review.json
git add data/eval/public/internal-eval-review.json
# if you published inventory:
git add data/eval/public/internal-eval-url-inventory.json
git commit -m "Update internal eval dataset"
git push
```

**Manual publish** — when you want a specific review queue file instead of the latest combined merge:

```bash
npm run eval:publish-internal -- data/eval/results/review_queue_<timestamp>.csv --include-domains
```

Writes `data/eval/public/internal-eval-review.json`. **Review before commit** — this is a deployable sanitized artifact. Use `--include-domains` to show customer domains to partners; omit it for `Site 1`, `Site 2` labels. Use `--no-include-logo-urls` to drop logo URLs and keep counts only.

`/eval-local` redirects to `/dev/eval`.

Set `EVAL_VIEWER_PASSWORD` in `.env.local` to test the deployed viewer locally. Without it, local dev still shows the sanitized sample fixture.
