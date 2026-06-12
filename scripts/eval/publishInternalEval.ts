#!/usr/bin/env node
/**
 * Publish a sanitized review queue JSON for deployed /internal/eval.
 *
 *   npm run eval:publish-internal -- data/eval/results/review_queue_<timestamp>.csv
 *   npm run eval:publish-internal -- data/eval/results/review_queue_<timestamp>.csv --include-domains
 */
import {
  isSafeReviewQueueInputPath,
  printPublishInternalEvalSummary,
  printPublishUrlInventorySummary,
  publishReviewQueueCsvToInternalEval,
  publishUrlInventoryToInternalEval,
} from "./lib/publishInternalEvalLib.js";
import {
  firstPositionalArg,
  getArg,
  hasFlag,
  printHelp,
} from "./lib/cliArgs.js";

function main(): void {
  const inputPath = firstPositionalArg();
  const includeDomains = hasFlag("--include-domains");
  const includeLogoUrls = !hasFlag("--no-include-logo-urls");
  const includeUrlInventory = hasFlag("--include-url-inventory");
  const includeProjectContext = hasFlag("--include-project-context");
  const urlCandidatesFilename = getArg("--url-candidates");

  if (!inputPath || hasFlag("--help") || hasFlag("-h")) {
    printHelp(
      "Usage: npm run eval:publish-internal -- <review_queue.csv> [options]",
      [
        "",
        "Reads a local review_queue_<timestamp>.csv and writes sanitized JSON:",
        "  data/eval/public/internal-eval-review.json",
        "",
        "Options:",
        "  --include-domains         Include canonical domains (default: Site 1, Site 2, …)",
        "  --include-url-inventory   Also publish sanitized URL inventory JSON",
        "  --include-project-context Include project titles in inventory",
        "  --url-candidates <file>   url_candidates CSV (default: largest real file)",
        "  --no-include-logo-urls    Omit logo URLs; keep logo counts only",
        "",
        "Review the JSON before commit. This creates a deployable artifact.",
        "",
        "Example:",
        "  npm run eval:publish-internal -- data/eval/results/review_queue_20260605212708.csv --include-domains",
      ],
    );
    process.exit(inputPath || hasFlag("--help") || hasFlag("-h") ? 0 : 1);
    return;
  }

  if (!isSafeReviewQueueInputPath(inputPath)) {
    console.error(
      "Input must be data/eval/results/review_queue_<timestamp>.csv, review_queue_combined_<timestamp>.csv, or manual_review_queue_<timestamp>.csv (gitignored raw file).",
    );
    process.exit(1);
  }

  try {
    const result = publishReviewQueueCsvToInternalEval(inputPath, {
      includeDomains,
      includeLogoUrls,
    });
    printPublishInternalEvalSummary(result);

    if (includeUrlInventory) {
      console.log("");
      const inventory = publishUrlInventoryToInternalEval(
        result.file.rows,
        result.file.source_review_queue,
        {
          includeDomains,
          includeProjectContext,
          includeLogoUrls,
        },
        urlCandidatesFilename,
      );
      printPublishUrlInventorySummary(inventory);
    }
  } catch (err) {
    console.error(
      err instanceof Error ? err.message : "Failed to publish internal eval.",
    );
    process.exit(1);
  }
}

main();
