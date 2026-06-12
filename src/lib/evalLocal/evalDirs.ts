import { mkdirSync } from "node:fs";
import { join } from "node:path";

export const EVAL_RESULTS_DIR = join(process.cwd(), "data", "eval", "results");
export const EVAL_RUNS_DIR = join(process.cwd(), "data", "eval", "runs");

export function ensureEvalDirs(): void {
  mkdirSync(EVAL_RESULTS_DIR, { recursive: true });
  mkdirSync(EVAL_RUNS_DIR, { recursive: true });
}

import { runTimestampIdUtc } from "./evalRunId";

/** UTC timestamp id shared with eval CLI scripts (YYYYMMDDHHmmssSSS). */
export function runTimestampId(): string {
  return runTimestampIdUtc();
}
