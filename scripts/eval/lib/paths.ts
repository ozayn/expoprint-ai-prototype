import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(__dirname, "..", "..", "..");

export const EVAL_DIR = join(REPO_ROOT, "data", "eval");
export const EVAL_RUNS_DIR = join(EVAL_DIR, "runs");
export const EVAL_RESULTS_DIR = join(EVAL_DIR, "results");
export const DEFAULT_EXAMPLE_CSV = join(EVAL_DIR, "metabase_sample.example.csv");

export function ensureEvalDirs(): void {
  mkdirSync(EVAL_RUNS_DIR, { recursive: true });
  mkdirSync(EVAL_RESULTS_DIR, { recursive: true });
}

export function runTimestampId(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    d.getUTCFullYear(),
    pad(d.getUTCMonth() + 1),
    pad(d.getUTCDate()),
    pad(d.getUTCHours()),
    pad(d.getUTCMinutes()),
    pad(d.getUTCSeconds()),
  ].join("");
}
