#!/usr/bin/env node
/**
 * Inspect palette_source coverage in review CSV or published JSON.
 *
 *   npm run eval:inspect-palette -- data/eval/results/review_queue_combined_<timestamp>.csv
 *   npm run eval:inspect-palette -- data/eval/public/internal-eval-review.json
 */
import { basename } from "node:path";
import { findLatestCombinedReviewQueuePath } from "./lib/combineReviewQueues.js";
import {
  inspectPaletteSourceInPublishedJson,
  inspectPaletteSourceInReviewCsv,
  printPaletteSourceInspection,
} from "./lib/inspectPaletteSource.js";
import { hasFlag, printHelp } from "./lib/cliArgs.js";

function main(): void {
  const args = process.argv.slice(2);
  if (hasFlag("--help") || hasFlag("-h") || args.length === 0) {
    printHelp(
      "Usage: npm run eval:inspect-palette -- <review_queue.csv|internal-eval-review.json>",
      [
        "  --latest-combined   Inspect newest review_queue_combined_*.csv",
        "",
        "Reports rows with colors, palette_source counts, and sample rows.",
      ],
    );
    process.exit(args.length === 0 && !hasFlag("--help") ? 1 : 0);
    return;
  }

  let targetPath: string;
  if (hasFlag("--latest-combined")) {
    targetPath = findLatestCombinedReviewQueuePath();
  } else {
    const positional = args.find((a) => !a.startsWith("--"));
    if (!positional) {
      console.error("Provide a CSV or JSON path, or use --latest-combined");
      process.exit(1);
      return;
    }
    targetPath = positional;
  }

  const name = basename(targetPath).toLowerCase();
  const inspection =
    name.endsWith(".json")
      ? inspectPaletteSourceInPublishedJson(targetPath)
      : inspectPaletteSourceInReviewCsv(targetPath);

  printPaletteSourceInspection(inspection);
}

main();
