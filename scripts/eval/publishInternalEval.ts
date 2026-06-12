#!/usr/bin/env node
/**
 * Publish a sanitized review queue JSON for deployed /internal/eval.
 *
 *   npm run eval:publish-internal -- data/eval/results/review_queue_<timestamp>.csv
 *   npm run eval:publish-internal -- data/eval/results/review_queue_<timestamp>.csv --include-domains
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { buildPublishedInternalEvalFile } from "../../src/lib/evalInternal/sanitizePublishedReview.js";
import {
  INTERNAL_EVAL_PUBLIC_DIR,
  INTERNAL_EVAL_REVIEW_PATH,
} from "../../src/lib/evalInternal/constants.js";
import { csvRowsToObjects, parseCsv } from "../../src/lib/evalLocal/parseCsv.js";
import { EVAL_RESULTS_DIR, REPO_ROOT } from "./lib/paths.js";
import {
  firstPositionalArg,
  hasFlag,
  printHelp,
} from "./lib/cliArgs.js";

function isSafeReviewQueueInputPath(inputPath: string): boolean {
  const name = basename(inputPath);
  if (!/^(?:review_queue_|manual_review_queue_)20\d{12}\.csv$/.test(name)) {
    return false;
  }
  const resolved = resolve(inputPath);
  const resultsDir = resolve(REPO_ROOT, "data", "eval", "results");
  return resolved.startsWith(resultsDir + "/") || resolved === resolve(resultsDir, name);
}

function main(): void {
  const inputPath = firstPositionalArg();
  const includeDomains = hasFlag("--include-domains");
  const includeLogoUrls = !hasFlag("--no-include-logo-urls");

  if (!inputPath || hasFlag("--help") || hasFlag("-h")) {
    printHelp(
      "Usage: npm run eval:publish-internal -- <review_queue.csv> [options]",
      [
        "",
        "Reads a local review_queue_<timestamp>.csv and writes sanitized JSON:",
        "  data/eval/public/internal-eval-review.json",
        "",
        "Options:",
        "  --include-domains       Include canonical domains (default: Site 1, Site 2, …)",
        "  --no-include-logo-urls  Omit logo URLs; keep logo counts only",
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
      "Input must be data/eval/results/review_queue_<timestamp>.csv or manual_review_queue_<timestamp>.csv (gitignored raw file).",
    );
    process.exit(1);
  }

  const resolvedInput = resolve(inputPath);
  if (!resolvedInput.startsWith(resolve(EVAL_RESULTS_DIR))) {
    console.error(`Input must live under ${EVAL_RESULTS_DIR}`);
    process.exit(1);
  }

  let text: string;
  try {
    text = readFileSync(resolvedInput, "utf8");
  } catch (err) {
    console.error(
      err instanceof Error ? err.message : "Failed to read review queue CSV.",
    );
    process.exit(1);
  }

  const { records } = csvRowsToObjects(parseCsv(text));
  const { file, stats } = buildPublishedInternalEvalFile(
    basename(resolvedInput),
    records,
    { includeDomains, includeLogoUrls },
  );

  mkdirSync(INTERNAL_EVAL_PUBLIC_DIR, { recursive: true });
  writeFileSync(
    INTERNAL_EVAL_REVIEW_PATH,
    JSON.stringify(file, null, 2) + "\n",
    "utf8",
  );

  console.log("Publish internal eval");
  console.log(`  Input:              ${resolvedInput}`);
  console.log(`  Rows read:            ${stats.rowsRead}`);
  console.log(`  Rows published:       ${stats.rowsPublished}`);
  console.log(`  Rows with logos:      ${stats.rowsWithLogos}`);
  console.log(`  Rows with palettes:   ${stats.rowsWithPalettes}`);
  console.log(`  Domains included:     ${includeDomains ? "yes" : "no (Site N labels)"}`);
  console.log(`  Logo URLs included:   ${includeLogoUrls ? "yes" : "no"}`);
  console.log(`  Output:               ${INTERNAL_EVAL_REVIEW_PATH}`);
  console.log("");
  console.log("Review the JSON before commit. Raw partner files stay local.");
}

main();
