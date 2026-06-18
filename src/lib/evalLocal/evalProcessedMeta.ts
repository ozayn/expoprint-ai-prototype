import type { BrandAuditRow } from "./brandAuditRow";
import { EVAL_RUN_ID_PATTERN } from "./evalRunId";
import {
  isBatchReviewQueueFilename,
  isCombinedReviewQueueFilename,
} from "./evalReviewQueueFiles";
import type { UrlInventoryRow } from "./urlInventoryJoin";

/** ISO-8601 UTC timestamp inferred from eval artifact run id (YYYYMMDDHHmmss[SSS]). */
export function evalRunIdToIso(runId: string): string | null {
  const trimmed = runId.trim();
  if (!trimmed) return null;

  const m14 = trimmed.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (m14) {
    const d = new Date(
      Date.UTC(
        Number(m14[1]),
        Number(m14[2]) - 1,
        Number(m14[3]),
        Number(m14[4]),
        Number(m14[5]),
        Number(m14[6]),
      ),
    );
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const m17 = trimmed.match(
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})$/,
  );
  if (m17) {
    const d = new Date(
      Date.UTC(
        Number(m17[1]),
        Number(m17[2]) - 1,
        Number(m17[3]),
        Number(m17[4]),
        Number(m17[5]),
        Number(m17[6]),
        Number(m17[7]),
      ),
    );
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  return null;
}

export function extractionRunIdFromReviewQueueName(filename: string): string {
  const name = filename.trim();
  const batch = name.match(new RegExp(`^review_queue_(${EVAL_RUN_ID_PATTERN})\\.csv$`));
  if (batch?.[1]) return batch[1];
  const manual = name.match(
    new RegExp(`^manual_review_queue_(${EVAL_RUN_ID_PATTERN})\\.csv$`),
  );
  if (manual?.[1]) return manual[1];
  const combined = name.match(
    new RegExp(`^review_queue_combined_(${EVAL_RUN_ID_PATTERN})\\.csv$`),
  );
  return combined?.[1] ?? "";
}

export function batchReviewQueueFilenameFromRunId(runId: string): string {
  const trimmed = runId.trim();
  if (!trimmed) return "";
  return `review_queue_${trimmed}.csv`;
}

export type UrlInventoryProcessedMeta = {
  sourceReviewQueue: string;
  extractionRunId: string;
  processedAt: string;
  isLatestBatch: boolean;
};

export function latestBatchRunIdFromQueueFilenames(filenames: string[]): string | null {
  let max = "";
  for (const name of filenames) {
    if (!isBatchReviewQueueFilename(name)) continue;
    const runId = extractionRunIdFromReviewQueueName(name);
    if (runId && runId > max) max = runId;
  }
  return max || null;
}

export function maxRunIdFromValues(runIds: string[]): string | null {
  let max = "";
  for (const id of runIds) {
    const trimmed = id.trim();
    if (trimmed && trimmed > max) max = trimmed;
  }
  return max || null;
}

/** Newest batch queue filename among sources (ignores combined queue filenames). */
export function newestSourceReviewQueueFromSources(sources: string[]): string | null {
  let maxRunId = "";
  let maxSource = "";

  for (const source of sources) {
    const trimmed = source.trim();
    if (!trimmed || isCombinedReviewQueueFilename(trimmed)) continue;

    const runId = extractionRunIdFromReviewQueueName(trimmed);
    if (runId && runId > maxRunId) {
      maxRunId = runId;
      maxSource = trimmed;
    }
  }

  return maxSource || null;
}

export function isLatestBatchSourceReviewQueue(
  sourceReviewQueue: string,
  newestSourceReviewQueue: string | null,
): boolean {
  const source = sourceReviewQueue.trim();
  if (!source || !newestSourceReviewQueue || isCombinedReviewQueueFilename(source)) {
    return false;
  }

  const rowRunId = extractionRunIdFromReviewQueueName(source);
  const newestRunId = extractionRunIdFromReviewQueueName(newestSourceReviewQueue);
  if (rowRunId && newestRunId) return rowRunId === newestRunId;
  return source === newestSourceReviewQueue.trim();
}

export function resolveSourceReviewQueueFromReview(
  review: BrandAuditRow,
  options?: {
    fallbackReviewQueueFilename?: string;
  },
): string {
  const fromReview = review.source_review_queue?.trim();
  if (fromReview && !isCombinedReviewQueueFilename(fromReview)) {
    return fromReview;
  }

  const runId = review.extraction_run_id?.trim();
  if (runId) return batchReviewQueueFilenameFromRunId(runId);

  const fallback = options?.fallbackReviewQueueFilename?.trim() ?? "";
  if (fallback && !isCombinedReviewQueueFilename(fallback)) {
    return fallback;
  }

  return fromReview || "";
}

export function processedMetaFromReviewRow(
  review: BrandAuditRow,
  options?: {
    fallbackReviewQueueFilename?: string;
    newestSourceReviewQueue?: string | null;
  },
): UrlInventoryProcessedMeta | null {
  const source = resolveSourceReviewQueueFromReview(review, options);
  if (!source) return null;

  const extractionRunId =
    review.extraction_run_id?.trim() ||
    extractionRunIdFromReviewQueueName(source);
  const processedAt =
    review.processed_at?.trim() ||
    (extractionRunId ? evalRunIdToIso(extractionRunId) : null) ||
    "";

  return {
    sourceReviewQueue: source,
    extractionRunId,
    processedAt,
    isLatestBatch: isLatestBatchSourceReviewQueue(
      source,
      options?.newestSourceReviewQueue ?? null,
    ),
  };
}

export function newestSourceReviewQueueFromInventoryRows(
  rows: UrlInventoryRow[],
): string | null {
  const sources: string[] = [];
  for (const row of rows) {
    if (row.extractionStatus === "not_run") continue;
    if (row.processedMeta?.sourceReviewQueue) {
      sources.push(row.processedMeta.sourceReviewQueue);
      continue;
    }
    if (row.review) {
      const source = resolveSourceReviewQueueFromReview(row.review);
      if (source) sources.push(source);
    }
  }
  return newestSourceReviewQueueFromSources(sources);
}

export function applyLatestBatchFlagsToInventoryRows(
  rows: UrlInventoryRow[],
): UrlInventoryRow[] {
  const newest = newestSourceReviewQueueFromInventoryRows(rows);
  return rows.map((row) => {
    if (!row.processedMeta) return row;
    return {
      ...row,
      processedMeta: {
        ...row.processedMeta,
        isLatestBatch: isLatestBatchSourceReviewQueue(
          row.processedMeta.sourceReviewQueue,
          newest,
        ),
      },
    };
  });
}

export function formatProcessedLabel(
  processedAt: string,
  isLatestBatch: boolean,
): string | null {
  if (isLatestBatch) return "Latest batch";
  if (!processedAt) return null;
  const d = new Date(processedAt);
  if (Number.isNaN(d.getTime())) return null;
  const formatted = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `Processed ${formatted}`;
}
