import { join } from "node:path";

export const INTERNAL_SAMPLE_DIR = join(
  process.cwd(),
  "data",
  "eval",
  "internal-sample",
);

/** Committed sanitized filenames — only these may be read by /internal/eval. */
export const INTERNAL_SAMPLE_FILES = {
  urlCandidates: "url_candidates.example.csv",
  extractionSummary: "extraction_summary.example.csv",
  reviewQueue: "review_queue.example.csv",
  extractionRun: "extraction_run.example.jsonl",
} as const;

const ALLOWED = new Set<string>(Object.values(INTERNAL_SAMPLE_FILES));

export function isAllowedInternalSampleFile(name: string): boolean {
  return ALLOWED.has(name);
}

export function isSafeInternalSummaryFilename(name: string): boolean {
  return name === INTERNAL_SAMPLE_FILES.extractionSummary;
}

export function isSafeInternalReviewQueueFilename(name: string): boolean {
  return name === INTERNAL_SAMPLE_FILES.reviewQueue;
}
