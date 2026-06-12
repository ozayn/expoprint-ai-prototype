#!/usr/bin/env node
/**
 * Merge batch review_queue_*.csv files into one deduped combined file.
 *
 *   npm run eval:combine-reviews
 */
import {
  combineReviewQueues,
  printCombineReviewQueuesSummary,
} from "./lib/combineReviewQueues.js";
import { hasFlag, printHelp } from "./lib/cliArgs.js";

function main(): void {
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp("Usage: npm run eval:combine-reviews", [
      "",
      "Combines all review_queue_<timestamp>.csv batch files into:",
      "  data/eval/results/review_queue_combined_<timestamp>.csv",
      "",
      "Deduplicates by normalized_url, keeping the newest row per URL.",
      "Adds a source_review_queue column with the originating batch filename.",
    ]);
    process.exit(0);
    return;
  }

  try {
    const result = combineReviewQueues();
    printCombineReviewQueuesSummary(result);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
