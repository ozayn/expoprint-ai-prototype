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
| `results/` | `url_candidates_*.csv`, `extraction_summary_*.csv` (gitignored) |

## URL candidates

```bash
npm run eval:urls -- data/private/eval/basic_design_service_query_2026-06-04.csv
npm run eval:urls -- data/eval/metabase_sample.example.csv
```

## Limited website extraction

After `eval:urls`, run a small sample only:

```bash
npm run eval:extract -- data/eval/results/url_candidates_<timestamp>.csv --limit 5
npm run eval:review -- data/eval/runs/extraction_run_<timestamp>.jsonl
```

See [`docs/evaluation/historical-extraction-evaluation.md`](../docs/evaluation/historical-extraction-evaluation.md).

## Viewers

| Route | Environment | Data |
| --- | --- | --- |
| [`/dev/eval`](http://localhost:3000/dev/eval) | Local dev only (`npm run dev`) | Gitignored `data/eval/runs/` + `results/` |
| [`/internal/eval`](http://localhost:3000/internal/eval) | Deployed (password) | Committed `internal-sample/` only |

`/eval-local` redirects to `/dev/eval`.

Set `INTERNAL_EVAL_PASSWORD` in `.env.local` to test the internal viewer locally.
