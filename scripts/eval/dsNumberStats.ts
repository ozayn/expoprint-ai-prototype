#!/usr/bin/env node
/**
 * Report ds_number coverage on a review queue CSV or the merged batch queues.
 *
 *   npm run eval:ds-number-stats
 *   npm run eval:ds-number-stats -- data/eval/results/review_queue_combined_*.csv
 */
import { readFileSync } from "node:fs";
import {
  firstPositionalArg,
  hasFlag,
  printHelp,
} from "./lib/cliArgs.js";
import { mergeBatchReviewQueuesInMemory } from "./lib/combineReviewQueues.js";
import {
  auditDsNumberCoverage,
  printDsNumberAudit,
} from "./lib/dsNumberAudit.js";
import { csvRowsToObjects, parseCsv } from "./lib/parseCsv.js";
import { emptyBrandAuditRow } from "../../src/lib/evalLocal/brandAuditRow.js";

function loadReviewRowsFromCsv(path: string) {
  const text = readFileSync(path, "utf8");
  const { records } = csvRowsToObjects(parseCsv(text));
  return records.map((record) => ({
    ...emptyBrandAuditRow(),
    ...record,
  }));
}

async function main(): Promise<void> {
  const argv = process.argv;
  if (hasFlag("--help", argv) || hasFlag("-h", argv)) {
    printHelp(
      "Usage: npm run eval:ds-number-stats -- [review_queue.csv]",
      [
        "Reports how many review rows have a non-empty ds_number.",
        "Without a path, audits merged batch review queues in memory.",
      ],
    );
    process.exit(0);
  }

  const inputPath = firstPositionalArg(argv);
  if (inputPath) {
    const rows = loadReviewRowsFromCsv(inputPath);
    printDsNumberAudit(auditDsNumberCoverage(rows), inputPath);
    return;
  }

  const { rows } = mergeBatchReviewQueuesInMemory();
  printDsNumberAudit(auditDsNumberCoverage(rows), "merged batch review queues");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
