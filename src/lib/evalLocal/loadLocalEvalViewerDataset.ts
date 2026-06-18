import {
  listLocalEvalFiles,
  pickReviewQueueFilename,
  pickScoreSummaryFilename,
  pickSummaryFilename,
  pickUrlCandidatesFilename,
  splitReviewQueueEntries,
  type EvalFileEntry,
  type LocalEvalFileIndex,
} from "@/lib/evalLocal/listEvalFiles";
import { readExtractionSummaryCsv } from "@/lib/evalLocal/readExtractionSummary";
import { readReviewQueueCsv } from "@/lib/evalLocal/readReviewQueue";
import { readScoreSummaryCsv } from "@/lib/evalLocal/readScoreSummary";
import { readUrlCandidatesCsv } from "@/lib/evalLocal/readUrlCandidates";
import {
  resolveUrlCandidatesParam,
  type EvalViewerQueryParams,
} from "@/lib/evalLocal/evalViewerQuery";
import {
  buildUrlInventory,
  type UrlInventoryBuildResult,
} from "@/lib/evalLocal/urlInventoryJoin";
import { isEvalViewerEnabled } from "@/lib/evalLocal/isEvalViewerEnabled";
import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";
import type { ExtractionSummaryRow } from "@/lib/evalLocal/extractionSummaryTypes";
import type { ParsedScoreSummary } from "@/lib/evalLocal/scoreSummaryTypes";

export const EVAL_VIEWER_BASE_PATH = "/internal/eval";

export type LocalEvalViewerDataset = {
  index: LocalEvalFileIndex;
  summaryName?: string;
  reviewName?: string;
  scoreName?: string;
  candidatesName?: string;
  summaryData: { filename: string; rows: ExtractionSummaryRow[] } | null;
  reviewData: Awaited<ReturnType<typeof readReviewQueueCsv>>;
  scoreData: ParsedScoreSummary | null;
  candidatesData: Awaited<ReturnType<typeof readUrlCandidatesCsv>>;
  reviewRows: BrandAuditRow[];
  urlInventory: UrlInventoryBuildResult | null;
  batchQueues: EvalFileEntry[];
  combinedQueues: EvalFileEntry[];
  publishHint?: string;
};

/**
 * Load gitignored local eval files for the unified viewer (development only).
 */
export async function loadLocalEvalViewerDataset(
  params: EvalViewerQueryParams,
): Promise<LocalEvalViewerDataset> {
  if (!isEvalViewerEnabled()) {
    throw new Error(
      "loadLocalEvalViewerDataset is only available in local development",
    );
  }

  const index = await listLocalEvalFiles();
  const summaryName = pickSummaryFilename(
    index.extractionSummaries,
    params.summary,
  );
  const { batchQueues, combinedQueues } = splitReviewQueueEntries(
    index.reviewQueues,
  );
  const reviewName = pickReviewQueueFilename(index.reviewQueues, params.review);
  const candidatesName = pickUrlCandidatesFilename(
    index.urlCandidates,
    resolveUrlCandidatesParam(params),
  );
  const scoreName = pickScoreSummaryFilename(
    index.scoreSummaries,
    params.score,
    reviewName,
  );

  const summaryData = summaryName
    ? await readExtractionSummaryCsv(summaryName)
    : null;
  const reviewData = reviewName ? await readReviewQueueCsv(reviewName) : null;
  const scoreData = scoreName ? await readScoreSummaryCsv(scoreName) : null;
  const candidatesData = candidatesName
    ? await readUrlCandidatesCsv(candidatesName)
    : null;

  const reviewRows = reviewData?.rows ?? [];
  const urlInventory = candidatesData
    ? buildUrlInventory(
        candidatesData.rows,
        reviewRows,
        "Local eval URL inventory",
        { reviewQueueFilename: reviewName },
      )
    : null;

  const publishHint = reviewName
    ? `npm run eval:publish-internal -- data/eval/results/${reviewName} --include-domains`
    : undefined;

  return {
    index,
    summaryName,
    reviewName,
    scoreName,
    candidatesName,
    summaryData,
    reviewData,
    scoreData,
    candidatesData,
    reviewRows,
    urlInventory,
    batchQueues,
    combinedQueues,
    publishHint,
  };
}
