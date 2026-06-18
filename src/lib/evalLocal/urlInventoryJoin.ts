import type { BrandAuditRow } from "./brandAuditRow";
import { canonicalDomainFromHost } from "./canonicalDomain";
import {
  dedupeEvalUrls,
  logEvalUrlDedupe,
  normalizeEvalUrl,
  urlDedupeKeyFromFields,
} from "./evalUrlDedup";
import {
  processedMetaFromReviewRow,
  type UrlInventoryProcessedMeta,
  applyLatestBatchFlagsToInventoryRows,
} from "./evalProcessedMeta";
import type { UrlCandidateRow } from "./urlCandidateTypes";

export type UrlInventoryExtractionStatus = "not_run" | "success" | "failed";

export type UrlInventoryRow = {
  candidate: UrlCandidateRow;
  extractionStatus: UrlInventoryExtractionStatus;
  review: BrandAuditRow | null;
  /** Stable index from URL candidates CSV for original-order sorting. */
  originalIndex: number;
  processedMeta: UrlInventoryProcessedMeta | null;
};

export type UrlInventoryStats = {
  totalCandidates: number;
  uniqueDomains: number;
  processedCount: number;
  notRunCount: number;
  successCount: number;
  failedCount: number;
  latestBatchCount: number;
};

function canonicalForCandidate(candidate: UrlCandidateRow): string {
  const fromField = candidate.canonical_domain?.trim();
  if (fromField) return canonicalDomainFromHost(fromField);
  const domain = candidate.domain?.trim();
  if (domain) return canonicalDomainFromHost(domain);
  const url = candidate.normalized_url?.trim();
  if (!url) return "";
  try {
    const parsed = new URL(
      /^https?:\/\//i.test(url) ? url : `https://${url}`,
    );
    return canonicalDomainFromHost(parsed.hostname);
  } catch {
    return "";
  }
}

export type UrlInventoryBuildResult = {
  rows: UrlInventoryRow[];
  stats: UrlInventoryStats;
  urlDuplicatesRemoved: number;
};

function extractionStatusRank(status: UrlInventoryExtractionStatus): number {
  if (status === "success") return 3;
  if (status === "failed") return 2;
  return 1;
}

function mergeSourceColumn(existing: string, next: string): string {
  if (!existing.trim()) return next.trim();
  if (!next.trim()) return existing.trim();
  const parts = existing.split("; ").map((s) => s.trim());
  const add = next.trim();
  if (parts.includes(add)) return existing;
  return `${existing}; ${add}`;
}

function mergeUrlInventoryRows(
  primary: UrlInventoryRow,
  secondary: UrlInventoryRow,
): UrlInventoryRow {
  const primaryRank = extractionStatusRank(primary.extractionStatus);
  const secondaryRank = extractionStatusRank(secondary.extractionStatus);
  const kept = primaryRank >= secondaryRank ? primary : secondary;
  const other = primaryRank >= secondaryRank ? secondary : primary;

  return {
    candidate: {
      ...kept.candidate,
      source_column: mergeSourceColumn(
        kept.candidate.source_column,
        other.candidate.source_column,
      ),
    },
    extractionStatus: kept.extractionStatus,
    review: kept.review ?? other.review,
    originalIndex: Math.min(primary.originalIndex, secondary.originalIndex),
    processedMeta: kept.processedMeta ?? other.processedMeta,
  };
}

function urlForInventoryRow(row: UrlInventoryRow): string {
  return urlDedupeKeyFromFields(
    row.candidate.normalized_url,
    row.candidate.raw_url,
    row.candidate.domain,
  ) ?? "";
}

export function dedupeUrlInventoryRows(
  rows: UrlInventoryRow[],
  logLabel?: string,
): UrlInventoryBuildResult {
  const result = dedupeEvalUrls(rows, urlForInventoryRow, mergeUrlInventoryRows);
  if (logLabel) {
    logEvalUrlDedupe(logLabel, result);
  }

  const stats = computeUrlInventoryStats(result.items);
  return {
    rows: result.items,
    stats,
    urlDuplicatesRemoved: result.duplicatesRemoved,
  };
}

function reviewExtractionStatus(review: BrandAuditRow): UrlInventoryExtractionStatus {
  const status = review.status?.trim() ?? "";
  if (status === "success") return "success";
  if (status) return "failed";
  return "failed";
}

function reviewUrlKey(url: string): string | null {
  return normalizeEvalUrl(url);
}

function buildReviewIndex(reviewRows: BrandAuditRow[]): Map<string, BrandAuditRow> {
  const index = new Map<string, BrandAuditRow>();

  for (const row of reviewRows) {
    const normalized = reviewUrlKey(row.normalized_url ?? "");
    if (normalized) {
      index.set(`url:${normalized}`, row);
    }
    const canonical =
      row.canonical_domain?.trim() ||
      canonicalDomainFromHost(row.domain ?? "");
    if (canonical) {
      index.set(`domain:${canonical}`, row);
    }
  }

  return index;
}

function findReviewForCandidate(
  candidate: UrlCandidateRow,
  index: Map<string, BrandAuditRow>,
): BrandAuditRow | null {
  const normalized = reviewUrlKey(candidate.normalized_url ?? "");
  if (normalized) {
    const byUrl = index.get(`url:${normalized}`);
    if (byUrl) return byUrl;
  }

  const canonical = canonicalForCandidate(candidate);
  if (canonical) {
    const byDomain = index.get(`domain:${canonical}`);
    if (byDomain) return byDomain;
  }

  return null;
}

export type UrlInventoryBuildOptions = {
  /** Batch/combined filename when a review row has no source_review_queue (non-combined only). */
  reviewQueueFilename?: string;
};

export function buildUrlInventory(
  candidates: UrlCandidateRow[],
  reviewRows: BrandAuditRow[],
  logLabel?: string,
  options?: UrlInventoryBuildOptions,
): UrlInventoryBuildResult {
  const index = buildReviewIndex(reviewRows);
  const rawRows: UrlInventoryRow[] = candidates.map((candidate, originalIndex) => {
    const review = findReviewForCandidate(candidate, index);
    const extractionStatus: UrlInventoryExtractionStatus = review
      ? reviewExtractionStatus(review)
      : "not_run";
    const processedMeta =
      review
        ? processedMetaFromReviewRow(review, {
            fallbackReviewQueueFilename: options?.reviewQueueFilename,
          })
        : null;
    return {
      candidate,
      extractionStatus,
      review,
      originalIndex,
      processedMeta,
    };
  });

  const deduped = dedupeUrlInventoryRows(rawRows, logLabel);
  return {
    ...deduped,
    rows: applyLatestBatchFlagsToInventoryRows(deduped.rows),
  };
}

export function computeUrlInventoryStats(
  rows: UrlInventoryRow[],
): UrlInventoryStats {
  const domains = new Set<string>();
  let notRunCount = 0;
  let successCount = 0;
  let failedCount = 0;
  let latestBatchCount = 0;

  for (const row of rows) {
    const canonical = canonicalForCandidate(row.candidate);
    if (canonical) domains.add(canonical);

    if (row.extractionStatus === "not_run") notRunCount += 1;
    else if (row.extractionStatus === "success") successCount += 1;
    else failedCount += 1;

    if (row.processedMeta?.isLatestBatch) latestBatchCount += 1;
  }

  const processedCount = successCount + failedCount;

  return {
    totalCandidates: rows.length,
    uniqueDomains: domains.size,
    processedCount,
    notRunCount,
    successCount,
    failedCount,
    latestBatchCount,
  };
}
