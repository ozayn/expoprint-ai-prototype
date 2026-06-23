#!/usr/bin/env node
/**
 * Compare a rerun batch against the pre-rerun baseline for contact field changes.
 *
 *   npm run eval:contact-delta -- --latest-run
 */
import { basename } from "node:path";
import { hasFlag, printHelp } from "./lib/cliArgs.js";
import { readReviewQueueCsvFromResults } from "./lib/combineReviewQueues.js";
import {
  buildContactDeltaReport,
  buildContactDeltaReportForLatestRun,
  printContactDeltaReport,
  resolvePreRerunBaseline,
} from "./lib/contactDeltaReport.js";
import { EVAL_RESULTS_DIR } from "./lib/paths.js";

function main(): void {
  const argv = process.argv;
  const showHelp = hasFlag("--help", argv) || hasFlag("-h", argv);

  if (showHelp) {
    printHelp(
      "Usage: npm run eval:contact-delta -- [review_queue.csv] [options]",
      [
        "Compare a rerun batch to the pre-rerun baseline and report contact field deltas.",
        "",
        "  --latest-run              Use the newest batch review_queue_*.csv",
        "  --example-limit N         Max examples per section (default: 10)",
        "",
        "Baseline priority:",
        "  1. Latest review_queue_combined_*.csv created before the batch run id",
        "  2. Merge all batch queues excluding the rerun batch",
        "",
        "Examples:",
        "  npm run eval:contact-delta -- --latest-run",
        "  npm run eval:contact-delta -- data/eval/results/review_queue_<id>.csv",
      ],
    );
    process.exit(0);
    return;
  }

  const latestRun = hasFlag("--latest-run", argv);
  const exampleLimitFlag = argv.find((a) => a.startsWith("--example-limit"));
  const exampleLimit = exampleLimitFlag
    ? Number.parseInt(
        exampleLimitFlag.split("=")[1] ??
          argv[argv.indexOf("--example-limit") + 1] ??
          "10",
        10,
      )
    : 10;

  if (latestRun) {
    const report = buildContactDeltaReportForLatestRun(EVAL_RESULTS_DIR, {
      exampleLimit,
    });
    printContactDeltaReport(report);
    return;
  }

  const positional = argv.slice(2).find((a) => !a.startsWith("--"));
  if (!positional) {
    console.error("Provide --latest-run or a review_queue CSV path");
    process.exit(1);
    return;
  }

  const latestBatchFilename = basename(positional);
  const latestBatchRows = readReviewQueueCsvFromResults(
    EVAL_RESULTS_DIR,
    latestBatchFilename,
  );
  const baseline = resolvePreRerunBaseline(EVAL_RESULTS_DIR, latestBatchFilename);
  const report = buildContactDeltaReport({
    latestBatchFilename,
    latestBatchRows,
    baselineRows: baseline.rows,
    baselineSource: baseline.source,
    baselineLabel: baseline.label,
    exampleLimit,
  });
  printContactDeltaReport(report);
}

main();
