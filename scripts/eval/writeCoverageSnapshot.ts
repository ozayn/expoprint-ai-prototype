#!/usr/bin/env node
/**
 * Record aggregate field-coverage metrics from a review queue CSV.
 *
 *   npm run eval:snapshot -- data/eval/results/review_queue_combined_<timestamp>.csv
 *   npm run eval:snapshot -- --latest-combined
 */
import { hasFlag, printHelp } from "./lib/cliArgs.js";
import {
  printCoverageSnapshotSummary,
  resolveReviewQueuePathForSnapshot,
  writeCoverageSnapshot,
} from "./lib/writeCoverageSnapshot.js";

function main(): void {
  const args = process.argv.slice(2);
  const showHelp = hasFlag("--help") || hasFlag("-h");

  if (showHelp || args.length === 0) {
    printHelp(
      "Usage: npm run eval:snapshot -- <review_queue.csv> [options]",
      [
        "  --latest-combined         Use the newest review_queue_combined_*.csv",
        "  --include-inventory       Join latest url_candidates CSV for inventory totals",
        "",
        "Writes aggregate metrics to data/eval/benchmarks/coverage_snapshots.json",
        "(no domains, URLs, or row-level partner data).",
        "",
        "Examples:",
        "  npm run eval:snapshot -- --latest-combined",
        "  npm run eval:snapshot -- data/eval/results/review_queue_combined_<timestamp>.csv --include-inventory",
      ],
    );
    process.exit(showHelp ? 0 : 1);
    return;
  }

  const latestCombined = hasFlag("--latest-combined");
  const includeInventory = hasFlag("--include-inventory");
  const positional = args.find(
    (a) => !a.startsWith("--") && !latestCombined,
  );

  if (!latestCombined && !positional) {
    console.error("Provide a review queue CSV path or --latest-combined");
    process.exit(1);
    return;
  }

  const reviewQueuePath = resolveReviewQueuePathForSnapshot({
    positionalPath: positional,
    latestCombined,
  });

  const result = writeCoverageSnapshot({
    reviewQueuePath,
    includeInventory,
  });
  printCoverageSnapshotSummary(result);
}

main();
