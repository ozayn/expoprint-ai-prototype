import { EVAL_RUN_ID_PATTERN } from "./evalRunId";

export const COMBINED_REVIEW_QUEUE_PREFIX = "review_queue_combined_";

export function isCombinedReviewQueueFilename(name: string): boolean {
  return new RegExp(`^${COMBINED_REVIEW_QUEUE_PREFIX}\\d+\\.csv$`).test(name);
}

export function isBatchReviewQueueFilename(name: string): boolean {
  return new RegExp(`^review_queue_${EVAL_RUN_ID_PATTERN}\\.csv$`).test(name);
}
