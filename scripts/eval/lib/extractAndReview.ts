import { basename } from "node:path";
import {
  combineReviewQueues,
  type CombineReviewQueuesResult,
} from "./combineReviewQueues.js";
import {
  buildReviewQueueFromJsonl,
  type ReviewQueueBuildResult,
} from "./historicalReviewQueue.js";
import {
  countRecordsByStatus,
  parseWebsiteExtractionCli,
  printWebsiteExtractionRunHeader,
  runHistoricalWebsiteExtraction,
  WEBSITE_EXTRACTION_CLI_HELP_LINES,
  type RunHistoricalWebsiteExtractionOptions,
} from "./historicalWebsiteExtraction.js";
import { hasFlag, printHelp } from "./cliArgs.js";
import {
  runPublishLatestInternalEval,
  type PublishLatestInternalEvalResult,
} from "./publishLatestInternalEval.js";
import {
  printCoverageSnapshotSummary,
  writeCoverageSnapshot,
  type WriteCoverageSnapshotResult,
} from "./writeCoverageSnapshot.js";
import {
  loadProcessedReviewIndexFromReviewQueues,
  loadProcessedStatusIndexFromReviewQueues,
} from "./reviewQueueProcessedIndex.js";
import type { UrlCandidateSelectionSummary } from "./selectUrlCandidates.js";
import {
  buildEvalViewerHref,
  defaultInventoryViewerQuery,
} from "../../../src/lib/evalLocal/evalViewerQuery.js";

export type ExtractAndReviewResult = {
  inputPath: string;
  limit: number;
  offset: number;
  jsonlPath: string;
  summaryPath: string;
  reviewQueuePath: string;
  selectedCount: number;
  recordsExtracted: number;
  successCount: number;
  errorCount: number;
  byStatus: Record<string, number>;
  review: ReviewQueueBuildResult;
  combined?: CombineReviewQueuesResult;
  published?: PublishLatestInternalEvalResult;
  coverageSnapshot?: WriteCoverageSnapshotResult;
  selectionSummary?: UrlCandidateSelectionSummary;
};

export function shouldPublishAfterExtractAndReview(options: {
  combine?: boolean;
  publish?: boolean;
  noPublish?: boolean;
}): boolean {
  if (options.noPublish) return false;
  if (options.publish) return true;
  return options.combine ?? false;
}

export function devEvalViewerUrl(reviewSelection: string): string {
  const base =
    process.env.DESIGN_INTAKE_API_URL?.replace(/\/$/, "") ??
    process.env.EVAL_VIEWER_BASE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  const href = buildEvalViewerHref(
    "/internal/eval",
    defaultInventoryViewerQuery({ review: reviewSelection }),
  );
  return `${base}${href}`;
}

export async function runExtractAndReview(
  inputPath: string,
  options: Omit<RunHistoricalWebsiteExtractionOptions, "inputPath"> & {
    combine?: boolean;
    publish?: boolean;
    noPublish?: boolean;
    snapshot?: boolean;
  },
): Promise<ExtractAndReviewResult> {
  const limit = options.limit ?? 10;
  const offset = options.offset ?? 0;
  const combine = options.combine ?? false;
  const snapshot = options.snapshot ?? false;
  const publishAfter = shouldPublishAfterExtractAndReview({
    combine,
    publish: options.publish,
    noPublish: options.noPublish,
  });

  const processedStatusIndex = loadProcessedStatusIndexFromReviewQueues();
  const retryFailed = options.processedSelection?.retryFailed ?? false;
  const reprocess = options.processedSelection?.reprocess ?? false;
  const reprocessMissingColors =
    options.processedSelection?.reprocessMissingColors ?? false;
  const preserveOrder = options.processedSelection?.preserveOrder ?? false;
  const rootOnly = options.processedSelection?.rootOnly ?? false;

  const processedReviewIndex = reprocessMissingColors
    ? loadProcessedReviewIndexFromReviewQueues()
    : options.processedSelection?.processedReviewIndex;

  printWebsiteExtractionRunHeader(inputPath, options, {
    skipProcessedByDefault: true,
    retryFailed,
    reprocess,
    reprocessMissingColors,
    mergedReviewRows: processedStatusIndex.size,
    prioritizeRootUrls: !preserveOrder,
    rootOnly,
  });

  const extraction = await runHistoricalWebsiteExtraction({
    inputPath,
    limit: options.limit,
    offset: options.offset,
    allowDuplicateDomains: options.allowDuplicateDomains,
    delayMs: options.delayMs,
    apiUrl: options.apiUrl,
    stylePreference: options.stylePreference,
    processedSelection: {
      processedStatusIndex,
      processedReviewIndex,
      retryFailed,
      reprocess,
      reprocessMissingColors,
      prioritizeRootUrls: !preserveOrder,
      preserveOrder,
      rootOnly,
    },
  });

  if (extraction.selectedCount === 0) {
    throw new Error(
      "No URL candidates selected for extraction (check --limit, --offset, not-run pool, and input file).",
    );
  }

  if (extraction.records.length === 0) {
    throw new Error(
      `Extraction produced no records (jsonl: ${extraction.jsonlPath}).`,
    );
  }

  console.log("");
  console.log("Building review queue from this extraction run…");

  const review = buildReviewQueueFromJsonl(extraction.jsonlPath);
  const byStatus = countRecordsByStatus(extraction.records);

  let combined: CombineReviewQueuesResult | undefined;
  if (combine) {
    console.log("");
    console.log("Combining all batch review queues…");
    combined = combineReviewQueues();
  }

  let published: PublishLatestInternalEvalResult | undefined;
  if (publishAfter) {
    console.log("");
    console.log("Publishing internal eval dataset for /internal/eval…");
    published = runPublishLatestInternalEval({
      includeDomains: true,
      includeUrlInventory: true,
      urlCandidatesFilename: basename(inputPath),
    });
    if (!published.partnerDataCheckPassed) {
      throw new Error(
        "Partner-data check failed after publish. Run npm run check:partner-data",
      );
    }
  }

  let coverageSnapshot: WriteCoverageSnapshotResult | undefined;
  if (snapshot && combine && combined) {
    console.log("");
    console.log("Writing coverage benchmark snapshot from combined queue…");
    coverageSnapshot = writeCoverageSnapshot({
      reviewQueuePath: combined.outputPath,
      includeInventory: true,
    });
    printCoverageSnapshotSummary(coverageSnapshot);
  } else if (snapshot && !combine) {
    console.warn(
      "Warning: --snapshot requires --combine (skipped writing coverage snapshot).",
    );
  }

  return {
    inputPath,
    limit,
    offset,
    jsonlPath: extraction.jsonlPath,
    summaryPath: extraction.summaryPath,
    reviewQueuePath: review.outputPath,
    selectedCount: extraction.selectedCount,
    recordsExtracted: extraction.records.length,
    successCount: review.successCount,
    errorCount: review.errorCount,
    byStatus,
    review,
    combined,
    published,
    coverageSnapshot,
    selectionSummary: extraction.selectionSummary,
  };
}

export function printExtractAndReviewSummary(result: ExtractAndReviewResult): void {
  const batchFilename = basename(result.reviewQueuePath);

  console.log("");
  console.log("Extract + review complete");
  console.log(`  Extraction run:      ${result.jsonlPath}`);
  console.log(`  Review queue:        ${result.reviewQueuePath}`);
  if (result.combined) {
    console.log(`  Combined queue:      ${result.combined.outputPath}`);
  }
  if (result.published) {
    console.log(`  Published review:    ${result.published.publish.outputPath}`);
    if (result.published.urlInventory) {
      console.log(
        `  Published inventory: ${result.published.urlInventory.outputPath}`,
      );
    }
  }
  console.log(`  Candidates file:     ${result.inputPath}`);
  console.log(`  Limit / offset:      ${result.limit} / ${result.offset}`);
  console.log(`  Extraction summary:  ${result.summaryPath}`);
  console.log(`  Rows extracted:      ${result.recordsExtracted}`);
  console.log(`  Success:             ${result.successCount}`);
  console.log(`  Errors:              ${result.errorCount}`);
  console.log("  By status:");
  for (const [status, count] of Object.entries(result.byStatus).sort()) {
    console.log(`    ${status}: ${count}`);
  }
  console.log(`  Latest batch viewer: ${devEvalViewerUrl("latest")}`);
  if (result.combined) {
    console.log(
      `  Combined viewer:     ${devEvalViewerUrl("combined")}`,
    );
  } else {
    console.log(
      `  Batch viewer:        ${devEvalViewerUrl(batchFilename)}`,
    );
  }
  if (result.published?.partnerDataCheckPassed) {
    console.log("  Partner-data check:  passed");
    console.log(
      "  Review data/eval/public/* before committing (publish does not git commit).",
    );
  }
  if (result.coverageSnapshot) {
    console.log(`  Coverage snapshot:   ${result.coverageSnapshot.outputPath}`);
  }
}

export async function runExtractAndReviewCli(): Promise<void> {
  const parsed = parseWebsiteExtractionCli();
  const combine = hasFlag("--combine");
  const retryFailed = hasFlag("--retry-failed");
  const reprocess = hasFlag("--reprocess");
  const reprocessMissingColors =
    hasFlag("--reprocess-missing-colors") ||
    hasFlag("--reprocess-missing-palettes");
  const preserveOrder = hasFlag("--preserve-order");
  const rootOnly = hasFlag("--root-only");
  const publish = hasFlag("--publish");
  const noPublish = hasFlag("--no-publish");
  const snapshot = hasFlag("--snapshot");

  if (parsed.showHelp) {
    printHelp(
      "Usage: npm run eval:extract-and-review -- <url_candidates.csv> [options]",
      [
        ...WEBSITE_EXTRACTION_CLI_HELP_LINES,
        "  --combine                 Also merge all batch review queues",
        "  --snapshot                With --combine, write coverage benchmark snapshot",
        "  --publish                 Publish to data/eval/public/ (review + URL inventory)",
        "  --no-publish              Skip publish even when --combine is set",
        "  --retry-failed            Include failed URLs from prior batches (default: not run only)",
        "  --reprocess               Include successful URLs from prior batches",
        "  --reprocess-missing-colors Reprocess successful rows with logo but no colors",
        "  --reprocess-missing-palettes Alias for --reprocess-missing-colors",
        "  --preserve-order          Keep eligible inventory order (no root URL prioritization)",
        "  --root-only               Process only root/homepage URLs",
        "",
        "With --combine, publishes sanitized JSON for /internal/eval by default",
        "(same as eval:publish-latest-internal --include-url-inventory --include-domains).",
        "Does not commit or push — review data/eval/public/* manually.",
        "",
        "By default, skips URLs already present in merged batch review queues.",
        "Eligible not-run URLs are sorted root-first before limit/offset.",
        "",
        "Runs eval:extract then eval:review on the exact JSONL from that run.",
        "",
        "Example:",
        "  npm run eval:extract-and-review -- data/eval/results/url_candidates_<id>.csv --limit 10 --combine",
      ],
    );
    process.exit(
      parsed.inputPath || hasFlag("--help") || hasFlag("-h") ? 0 : 1,
    );
    return;
  }

  const result = await runExtractAndReview(parsed.inputPath!, {
    ...parsed.options,
    combine,
    publish,
    noPublish,
    snapshot,
    processedSelection: {
      retryFailed,
      reprocess,
      reprocessMissingColors,
      preserveOrder,
      rootOnly,
    },
  });
  printExtractAndReviewSummary(result);
}
