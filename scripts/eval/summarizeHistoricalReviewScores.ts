#!/usr/bin/env node
/**
 * Summarize manually scored review queue CSVs.
 *
 *   npm run eval:score -- data/eval/results/review_queue_<timestamp>.csv
 */
import { firstPositionalArg, hasFlag, printHelp } from "./lib/cliArgs.js";
import {
  printScoreSummaryResult,
  summarizeReviewQueueFile,
} from "./lib/reviewScoreSummary.js";

function main(): void {
  const inputPath = firstPositionalArg();
  const strict = hasFlag("--strict");
  const csvOnly = hasFlag("--csv-only");

  if (!inputPath || hasFlag("--help") || hasFlag("-h")) {
    printHelp(
      "Usage: npm run eval:score -- <review_queue.csv> [--strict] [--csv-only]",
      [
        "",
        "Reads a manually scored review_queue_<timestamp>.csv and writes:",
        "  data/eval/results/score_summary_<timestamp>.csv",
        "  data/eval/results/score_summary_<timestamp>.json  (unless --csv-only)",
        "",
        "Accepted score values: 0, 1, 2, 3, N/A, or blank.",
        "Invalid values warn by default; use --strict to fail.",
        "",
        "Example:",
        "  npm run eval:score -- data/eval/results/review_queue_20260604202106.csv",
      ],
    );
    process.exit(inputPath || hasFlag("--help") || hasFlag("-h") ? 0 : 1);
    return;
  }

  try {
    const result = summarizeReviewQueueFile(inputPath, {
      strict,
      writeJson: !csvOnly,
    });
    printScoreSummaryResult(result);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
