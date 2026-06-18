#!/usr/bin/env node
/**
 * Backfill palette_source / palette_confidence on legacy review rows with colors.
 *
 *   npm run eval:backfill-palette -- --latest-combined --dry-run
 *   npm run eval:backfill-palette -- --latest-combined
 *   npm run eval:backfill-palette -- data/eval/public/internal-eval-review.json
 */
import { findLatestCombinedReviewQueuePath } from "./lib/combineReviewQueues.js";
import {
  backfillPaletteMetadataFile,
  printBackfillPaletteSummary,
} from "./lib/backfillPaletteMetadataLib.js";
import { hasFlag, printHelp } from "./lib/cliArgs.js";

function main(): void {
  const args = process.argv.slice(2);
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp("Usage: npm run eval:backfill-palette -- [options] [path]", [
      "",
      "Backfills palette_source and palette_confidence when colors exist but source is empty.",
      "Does not re-fetch websites or modify colors, logos, or other extracted fields.",
      "",
      "Inputs:",
      "  review_queue_<timestamp>.csv",
      "  review_queue_combined_<timestamp>.csv",
      "  internal-eval-review.json",
      "",
      "Options:",
      "  --latest-combined   Backfill newest review_queue_combined_*.csv",
      "  --dry-run           Print proposed changes only",
      "  --no-publish        Skip publish step after combined CSV backfill",
      "",
      "Combined CSV backfill automatically republishes internal-eval-review.json.",
    ]);
    process.exit(0);
    return;
  }

  let inputPath: string;
  if (hasFlag("--latest-combined")) {
    inputPath = findLatestCombinedReviewQueuePath();
  } else {
    const positional = args.find((a) => !a.startsWith("--"));
    if (!positional) {
      console.error("Provide a CSV or JSON path, or use --latest-combined");
      process.exit(1);
      return;
    }
    inputPath = positional;
  }

  try {
    const result = backfillPaletteMetadataFile(inputPath, {
      dryRun: hasFlag("--dry-run"),
      publishAfterCombined: !hasFlag("--no-publish"),
      includeDomains: !hasFlag("--no-include-domains"),
      includeLogoUrls: !hasFlag("--no-include-logo-urls"),
    });
    printBackfillPaletteSummary(result);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
