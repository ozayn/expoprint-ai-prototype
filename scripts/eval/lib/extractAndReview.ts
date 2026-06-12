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
};

export function devEvalViewerUrl(reviewSelection: string): string {
  const base =
    process.env.DESIGN_INTAKE_API_URL?.replace(/\/$/, "") ??
    process.env.EVAL_VIEWER_BASE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  const q = new URLSearchParams({ review: reviewSelection });
  return `${base}/dev/eval?${q.toString()}`;
}

export async function runExtractAndReview(
  inputPath: string,
  options: Omit<RunHistoricalWebsiteExtractionOptions, "inputPath"> & {
    combine?: boolean;
  },
): Promise<ExtractAndReviewResult> {
  const limit = options.limit ?? 10;
  const offset = options.offset ?? 0;
  const combine = options.combine ?? false;

  printWebsiteExtractionRunHeader(inputPath, options);

  const extraction = await runHistoricalWebsiteExtraction({
    inputPath,
    limit: options.limit,
    offset: options.offset,
    allowDuplicateDomains: options.allowDuplicateDomains,
    delayMs: options.delayMs,
    apiUrl: options.apiUrl,
    stylePreference: options.stylePreference,
  });

  if (extraction.selectedCount === 0) {
    throw new Error(
      "No URL candidates selected for extraction (check --limit, --offset, and input file).",
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
  };
}

export function printExtractAndReviewSummary(result: ExtractAndReviewResult): void {
  const batchFilename = basename(result.reviewQueuePath);

  console.log("");
  console.log("Extract + review complete");
  console.log(`  Candidates file:     ${result.inputPath}`);
  console.log(`  Limit / offset:      ${result.limit} / ${result.offset}`);
  console.log(`  Extraction run:      ${result.jsonlPath}`);
  console.log(`  Extraction summary:  ${result.summaryPath}`);
  console.log(`  Review queue:        ${result.reviewQueuePath}`);
  console.log(`  Rows extracted:      ${result.recordsExtracted}`);
  console.log(`  Success:             ${result.successCount}`);
  console.log(`  Errors:              ${result.errorCount}`);
  console.log("  By status:");
  for (const [status, count] of Object.entries(result.byStatus).sort()) {
    console.log(`    ${status}: ${count}`);
  }
  console.log(`  Latest batch viewer: ${devEvalViewerUrl("latest")}`);
  if (result.combined) {
    console.log(`  Combined file:       ${result.combined.outputPath}`);
    console.log(
      `  Combined viewer:     ${devEvalViewerUrl("combined")}`,
    );
  } else {
    console.log(
      `  Batch viewer:        ${devEvalViewerUrl(batchFilename)}`,
    );
  }
}

export async function runExtractAndReviewCli(): Promise<void> {
  const parsed = parseWebsiteExtractionCli();
  const combine = hasFlag("--combine");

  if (parsed.showHelp) {
    printHelp(
      "Usage: npm run eval:extract-and-review -- <url_candidates.csv> [options]",
      [
        ...WEBSITE_EXTRACTION_CLI_HELP_LINES,
        "  --combine                 Also merge all batch review queues",
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
  });
  printExtractAndReviewSummary(result);
}
