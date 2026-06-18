import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";
import { normalizeBrandAuditRow } from "@/lib/evalLocal/brandAuditRow";
import type {
  PublishedInternalEvalUrlInventoryFile,
  PublishedUrlInventoryRow,
} from "@/lib/evalLocal/publishedInternalEvalTypes";
import {
  batchReviewQueueFilenameFromRunId,
  extractionRunIdFromReviewQueueName,
  newestSourceReviewQueueFromSources,
  processedMetaFromReviewRow,
  resolveSourceReviewQueueFromReview,
} from "@/lib/evalLocal/evalProcessedMeta";
import { isCombinedReviewQueueFilename } from "@/lib/evalLocal/evalReviewQueueFiles";
import {
  URL_CANDIDATE_COLUMNS,
  type UrlCandidateRow,
} from "@/lib/evalLocal/urlCandidateTypes";
import type { UrlInventoryRow } from "@/lib/evalLocal/urlInventoryJoin";
import { dedupeUrlInventoryRows } from "@/lib/evalLocal/urlInventoryJoin";
import { parseDuplicateVariants } from "@/lib/evalLocal/evalCanonicalDedup";

function publishedRowBatchSource(
  row: PublishedUrlInventoryRow,
  combinedDatasetRunId?: string,
): string {
  const fromRow = row.source_review_queue?.trim();
  if (fromRow && !isCombinedReviewQueueFilename(fromRow)) {
    return fromRow;
  }

  const rowRunId = row.extraction_run_id?.trim();
  if (rowRunId && rowRunId !== combinedDatasetRunId) {
    return batchReviewQueueFilenameFromRunId(rowRunId);
  }

  if (row.review) {
    const fromReview = resolveSourceReviewQueueFromReview(row.review);
    if (fromReview) return fromReview;
    const reviewRunId = row.review.extraction_run_id?.trim();
    if (reviewRunId && reviewRunId !== combinedDatasetRunId) {
      return batchReviewQueueFilenameFromRunId(reviewRunId);
    }
  }

  return "";
}

function newestSourceReviewQueueFromPublishedInventoryRows(
  rows: PublishedUrlInventoryRow[],
  datasetSourceReviewQueue?: string,
): string | null {
  const combinedDatasetRunId = datasetSourceReviewQueue
    ? extractionRunIdFromReviewQueueName(datasetSourceReviewQueue)
    : "";

  const sources: string[] = [];
  for (const row of rows) {
    if (row.extraction_status === "not_run") continue;
    const source = publishedRowBatchSource(row, combinedDatasetRunId);
    if (source) sources.push(source);
  }
  return newestSourceReviewQueueFromSources(sources);
}

export function publishedUrlInventoryRowToUrlInventoryRow(
  row: PublishedUrlInventoryRow,
  originalIndex = 0,
  newestSourceReviewQueue?: string | null,
  combinedDatasetRunId?: string,
): UrlInventoryRow {
  const candidate = Object.fromEntries(
    URL_CANDIDATE_COLUMNS.map((col) => [col, ""]),
  ) as UrlCandidateRow;

  candidate.domain = row.domain?.trim() || row.row_label?.trim() || "";
  candidate.canonical_domain = row.canonical_domain?.trim() || "";
  candidate.normalized_url = row.normalized_url?.trim() || "";
  candidate.project_title = row.project_title?.trim() || "";
  candidate.project_type = row.project_type?.trim() || "";
  candidate.source_column = row.source_column?.trim() || "";

  let review: BrandAuditRow | null = null;
  if (row.review) {
    review = normalizeBrandAuditRow(row.review) ?? null;
    const batchSource = publishedRowBatchSource(row, combinedDatasetRunId);
    if (review && batchSource) {
      review.source_review_queue = batchSource;
    }
    if (review && row.extraction_run_id?.trim()) {
      const rowRunId = row.extraction_run_id.trim();
      if (!combinedDatasetRunId || rowRunId !== combinedDatasetRunId) {
        review.extraction_run_id = rowRunId;
      }
    }
    if (review && row.processed_at?.trim()) {
      review.processed_at = row.processed_at.trim();
    }
  }

  const processedMeta =
    review
      ? processedMetaFromReviewRow(review, {
          newestSourceReviewQueue,
        })
      : null;

  const duplicateVariants = parseDuplicateVariants(row.duplicate_source_urls);

  return {
    candidate,
    extractionStatus: row.extraction_status,
    review,
    originalIndex,
    processedMeta,
    duplicateVariants:
      duplicateVariants.length > 0 ? duplicateVariants : undefined,
  };
}

export function mapPublishedUrlInventoryRows(
  rows: PublishedUrlInventoryRow[],
  datasetSourceReviewQueue?: string,
): UrlInventoryRow[] {
  const combinedDatasetRunId = datasetSourceReviewQueue
    ? extractionRunIdFromReviewQueueName(datasetSourceReviewQueue)
    : "";
  const newestSource = newestSourceReviewQueueFromPublishedInventoryRows(
    rows,
    datasetSourceReviewQueue,
  );

  return rows.map((row, index) =>
    publishedUrlInventoryRowToUrlInventoryRow(
      row,
      index,
      newestSource,
      combinedDatasetRunId,
    ),
  );
}

export function publishedUrlInventoryRowsToUrlInventoryRows(
  rows: PublishedUrlInventoryRow[],
  datasetSourceReviewQueue?: string,
): UrlInventoryRow[] {
  const mapped = mapPublishedUrlInventoryRows(rows, datasetSourceReviewQueue);
  return dedupeUrlInventoryRows(mapped, undefined, rows.length).rows;
}

export function parsePublishedUrlInventoryFile(
  raw: string,
  filename: string,
): PublishedInternalEvalUrlInventoryFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid URL inventory JSON fixture: ${filename}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`URL inventory JSON must be an object: ${filename}`);
  }

  const file = parsed as Partial<PublishedInternalEvalUrlInventoryFile>;
  if (!Array.isArray(file.rows)) {
    throw new Error(`URL inventory JSON must include a rows array: ${filename}`);
  }

  return {
    description:
      file.description ??
      "Sanitized published URL inventory for /internal/eval.",
    published_at: file.published_at ?? "",
    source_url_candidates: file.source_url_candidates ?? "",
    source_review_queue: file.source_review_queue ?? "",
    include_domains: file.include_domains ?? false,
    include_project_context: file.include_project_context ?? false,
    include_logo_urls: file.include_logo_urls ?? true,
    rows: file.rows,
  };
}
