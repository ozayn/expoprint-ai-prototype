#!/usr/bin/env bash
# Fail if partner / eval outputs are staged, tracked, or about to be pushed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ALLOWED=(
  "data/eval/metabase_sample.example.csv"
  "data/eval/public-sample-review.json"
  "data/eval/public/internal-eval-review.json"
  "data/eval/public/.gitkeep"
  "data/eval/.gitkeep"
  "data/eval/runs/.gitkeep"
  "data/eval/results/.gitkeep"
  "data/extraction-eval-fixtures.json"
)

is_allowed() {
  local f="$1"
  for a in "${ALLOWED[@]}"; do
    [[ "$f" == "$a" ]] && return 0
  done
  return 1
}

is_forbidden() {
  local f="$1"
  [[ -z "$f" ]] && return 1
  is_allowed "$f" && return 1

  case "$f" in
    data/private/*) return 0 ;;
    data/eval/runs/*)
      [[ "$f" == "data/eval/runs/.gitkeep" ]] && return 1
      return 0
      ;;
    data/eval/results/*)
      [[ "$f" == "data/eval/results/.gitkeep" ]] && return 1
      return 0
      ;;
    *.local.csv) return 0 ;;
    data/eval/*.csv) return 0 ;;
    data/*/url_candidates_*.csv | data/*/*/url_candidates_*.csv) return 0 ;;
    data/*/extraction_summary_*.csv | data/*/*/extraction_summary_*.csv) return 0 ;;
    data/*/review_queue_*.csv | data/*/*/review_queue_*.csv) return 0 ;;
    data/*/score_summary_*.csv | data/*/*/score_summary_*.csv) return 0 ;;
    data/*/score_summary_*.json | data/*/*/score_summary_*.json) return 0 ;;
    data/*/extraction_run_*.jsonl | data/*/*/extraction_run_*.jsonl) return 0 ;;
    data/*/run_*.jsonl | data/*/*/run_*.jsonl) return 0 ;;
    data/*/results_*.csv | data/*/*/results_*.csv) return 0 ;;
    *basic_design_service_query*.csv) return 0 ;;
  esac
  return 1
}

collect_files() {
  {
    git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true
    git ls-files 2>/dev/null || true
  } | sort -u
}

collect_push_files() {
  while read -r _local_ref local_sha _remote_ref remote_sha; do
    [[ -z "${local_sha:-}" ]] && continue
    if [[ "$local_sha" == "0000000000000000000000000000000000000000" ]]; then
      continue
    fi
    if [[ "${remote_sha:-}" == "0000000000000000000000000000000000000000" ]]; then
      git diff-tree --no-commit-id --name-only --diff-filter=ACMRT -r "$local_sha" 2>/dev/null || true
    else
      git diff --name-only --diff-filter=ACMRT "${remote_sha}".."${local_sha}" 2>/dev/null || true
    fi
  done
}

violations=()
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  if is_forbidden "$f"; then
    violations+=("$f")
  fi
done < <(collect_files)

if [[ "${1:-}" == "--push" ]]; then
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    if is_forbidden "$f"; then
      violations+=("$f")
    fi
  done < <(collect_push_files)
fi

if [[ ${#violations[@]} -eq 0 ]]; then
  exit 0
fi

echo "ERROR: Partner or eval data must not be committed or pushed to GitHub." >&2
echo "" >&2
echo "Blocked paths:" >&2
printf '%s\n' "${violations[@]}" | sort -u | while IFS= read -r f; do
  echo "  - $f" >&2
done
echo "" >&2
echo "These belong under data/private/ or data/eval/ (gitignored)." >&2
echo "Run: git reset HEAD -- <path>   and verify .gitignore." >&2
echo "Install push guard: ./scripts/install-git-hooks.sh" >&2
exit 1
