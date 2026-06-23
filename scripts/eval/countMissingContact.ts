#!/usr/bin/env node
/**
 * Count successful review rows (and URL inventory candidates) missing contact fields.
 *
 *   npm run eval:count-missing-contact -- data/eval/results/url_candidates_<id>.csv
 */
import {
  firstPositionalArg,
  getArgNumber,
  hasFlag,
  printHelp,
} from "./lib/cliArgs.js";
import { mergeBatchReviewQueuesInMemory } from "./lib/combineReviewQueues.js";
import {
  countMissingContactOnSuccessfulRows,
  missingContactFilterLabel,
  parseMissingContactFilter,
  reviewRowMatchesMissingContactFilter,
} from "./lib/missingContactSelection.js";
import {
  loadProcessedReviewIndexFromReviewQueues,
  loadProcessedStatusIndexFromReviewQueues,
} from "./lib/reviewQueueProcessedIndex.js";
import {
  selectUrlCandidatesWithSummary,
  printUrlCandidateSelectionSummary,
} from "./lib/selectUrlCandidates.js";
import { loadUrlCandidatesFromCsv } from "./lib/urlCandidates.js";

async function main(): Promise<void> {
  const argv = process.argv;
  if (hasFlag("--help", argv) || hasFlag("-h", argv)) {
    printHelp(
      "Usage: npm run eval:count-missing-contact -- <url_candidates.csv> [options]",
      [
        "Counts successful processed rows missing contact fields, and previews",
        "how many URL candidates would be selected for a targeted rerun.",
        "",
        "  --missing-contact   Any of email, phone, address, social missing",
        "  --missing-email     Only rows missing email",
        "  --missing-phone     Only rows missing phone",
        "  --missing-address   Only rows missing address",
        "  --missing-social    Only rows missing social links",
        "  --limit N           Preview selection limit (default: all eligible)",
        "  --offset N          Preview selection offset",
        "  --root-only         Match extract-and-review --root-only pool",
      ],
    );
    process.exit(0);
  }

  const inputPath = firstPositionalArg(argv);
  if (!inputPath) {
    console.error("Missing url_candidates.csv path");
    process.exit(1);
  }

  const filter = parseMissingContactFilter(argv) ?? {
    fields: ["email", "phone", "address", "social"],
  };

  const { rows: mergedRows } = mergeBatchReviewQueuesInMemory();
  const successful = mergedRows.filter((r) => r.status?.trim() === "success");
  const counts = countMissingContactOnSuccessfulRows(mergedRows);

  const matchingSuccessful = successful.filter((row) =>
    reviewRowMatchesMissingContactFilter(row, filter),
  );

  console.log("Missing contact field counts (merged batch review queues)");
  console.log(`  Successful rows total:     ${successful.length.toLocaleString()}`);
  console.log(`  Missing email:             ${counts.email.toLocaleString()}`);
  console.log(`  Missing phone:             ${counts.phone.toLocaleString()}`);
  console.log(`  Missing address:           ${counts.address.toLocaleString()}`);
  console.log(`  Missing social:            ${counts.social.toLocaleString()}`);
  console.log(`  Missing any contact field: ${counts.any.toLocaleString()}`);
  console.log(
    `  Match filter (${missingContactFilterLabel(filter)}): ${matchingSuccessful.length.toLocaleString()} successful rows`,
  );

  const { candidates } = loadUrlCandidatesFromCsv(inputPath);
  const processedStatusIndex = loadProcessedStatusIndexFromReviewQueues();
  const processedReviewIndex = loadProcessedReviewIndexFromReviewQueues();

  const limit = getArgNumber("--limit", matchingSuccessful.length, argv);
  const offset = getArgNumber("--offset", 0, argv);

  const selection = selectUrlCandidatesWithSummary(candidates, {
    allowDuplicateDomains: false,
    offset,
    limit: limit > 0 ? limit : matchingSuccessful.length,
    processedStatusIndex,
    processedReviewIndex,
    reprocessMissingContact: true,
    missingContactFilter: filter,
    prioritizeRootUrls: !hasFlag("--preserve-order", argv),
    preserveOrder: hasFlag("--preserve-order", argv),
    rootOnly: hasFlag("--root-only", argv),
  });

  console.log("");
  console.log(`URL candidate preview (${inputPath})`);
  if (selection.summary) {
    printUrlCandidateSelectionSummary(selection.summary);
  }

  console.log("");
  console.log("Rerun command (non-destructive — writes new extraction_run_*.jsonl):");
  const flagParts: string[] = [];
  if (filter.fields.length === 4) {
    flagParts.push("--missing-contact");
  } else {
    for (const field of filter.fields) {
      flagParts.push(`--missing-${field}`);
    }
  }
  const rootOnly = hasFlag("--root-only", argv) ? " --root-only" : "";
  console.log(
    `  npm run eval:extract-and-review -- ${inputPath} ${flagParts.join(" ")} --limit ${limit > 0 ? limit : "<N>"} --combine --snapshot${rootOnly}`,
  );
  console.log("");
  console.log("Refresh dashboard metrics after combine/publish:");
  console.log("  npm run eval:snapshot -- --latest-combined");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
