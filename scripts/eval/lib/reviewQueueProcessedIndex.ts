import { canonicalSiteDedupeKeyFromFields } from "../../../src/lib/evalLocal/evalCanonicalDedup.js";
import type { ReviewQueueRow } from "./historicalReviewQueue.js";
import {
  mergeBatchReviewQueuesInMemory,
  type CombinedReviewQueueRow,
} from "./combineReviewQueues.js";
import { EVAL_RESULTS_DIR } from "./paths.js";

export type ProcessedExtractionOutcome = "success" | "failed";

export function canonicalSiteKeyForReviewRow(row: ReviewQueueRow): string | null {
  return canonicalSiteDedupeKeyFromFields({
    canonical_domain: row.canonical_domain,
    domain: row.domain,
    normalized_url: row.normalized_url,
  });
}

export function reviewRowExtractionOutcome(row: ReviewQueueRow): ProcessedExtractionOutcome {
  return row.status?.trim() === "success" ? "success" : "failed";
}

/** One outcome per canonical site from merged review queue rows. */
export function buildProcessedStatusIndex(
  rows: ReviewQueueRow[],
): Map<string, ProcessedExtractionOutcome> {
  const index = new Map<string, ProcessedExtractionOutcome>();
  for (const row of rows) {
    const key = canonicalSiteKeyForReviewRow(row);
    if (!key) continue;
    index.set(key, reviewRowExtractionOutcome(row));
  }
  return index;
}

export function loadProcessedStatusIndexFromReviewQueues(
  resultsDir: string = EVAL_RESULTS_DIR,
): Map<string, ProcessedExtractionOutcome> {
  const { rows } = mergeBatchReviewQueuesInMemory(resultsDir);
  return buildProcessedStatusIndex(rows);
}

/** One review row per canonical site from merged batch queues (for field checks). */
export function buildProcessedReviewIndex(
  rows: ReviewQueueRow[],
): Map<string, ReviewQueueRow> {
  const index = new Map<string, ReviewQueueRow>();
  for (const row of rows) {
    const key = canonicalSiteKeyForReviewRow(row);
    if (!key) continue;
    index.set(key, row);
  }
  return index;
}

export function loadProcessedReviewIndexFromReviewQueues(
  resultsDir: string = EVAL_RESULTS_DIR,
): Map<string, ReviewQueueRow> {
  const { rows } = mergeBatchReviewQueuesInMemory(resultsDir);
  return buildProcessedReviewIndex(rows);
}

export function countMergedReviewQueueOutcomes(
  rows: CombinedReviewQueueRow[],
): { success: number; failed: number } {
  let success = 0;
  let failed = 0;
  for (const row of rows) {
    if (reviewRowExtractionOutcome(row) === "success") success += 1;
    else failed += 1;
  }
  return { success, failed };
}
