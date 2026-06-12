import { mkdirSync } from "node:fs";
import { join } from "node:path";

export const EVAL_RESULTS_DIR = join(process.cwd(), "data", "eval", "results");
export const EVAL_RUNS_DIR = join(process.cwd(), "data", "eval", "runs");

export function ensureEvalDirs(): void {
  mkdirSync(EVAL_RESULTS_DIR, { recursive: true });
  mkdirSync(EVAL_RUNS_DIR, { recursive: true });
}

/** Local timestamp id shared with eval CLI scripts (YYYYMMDDHHmmss). */
export function runTimestampId(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
