#!/usr/bin/env node
/**
 * Build a manual review/comparison CSV from an extraction run JSONL.
 *
 *   npm run eval:review -- data/eval/runs/extraction_run_<timestamp>.jsonl
 */
import {
  buildReviewQueueFromJsonl,
  printReviewQueueSummary,
} from "./lib/historicalReviewQueue.js";
import { firstPositionalArg, hasFlag, printHelp } from "./lib/cliArgs.js";

function main(): void {
  const inputPath = firstPositionalArg();

  if (!inputPath || hasFlag("--help") || hasFlag("-h")) {
    printHelp(
      "Usage: npm run eval:review -- <extraction_run.jsonl>",
      [
        "",
      "Reads extraction_run_<timestamp>.jsonl or manual_extraction_run_<timestamp>.jsonl and writes:",
      "  review_queue_<timestamp>.csv or manual_review_queue_<timestamp>.csv",
        "",
        "Example:",
        "  npm run eval:review -- data/eval/runs/extraction_run_20260604202106.jsonl",
      ],
    );
    process.exit(inputPath || hasFlag("--help") || hasFlag("-h") ? 0 : 1);
    return;
  }

  try {
    const result = buildReviewQueueFromJsonl(inputPath);
    printReviewQueueSummary(result);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
