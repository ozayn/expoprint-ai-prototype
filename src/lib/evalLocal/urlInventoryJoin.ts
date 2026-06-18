import type { BrandAuditRow } from "./brandAuditRow";
import { canonicalDomainFromHost } from "./canonicalDomain";
import {
  canonicalDomainKeyFromFields,
  canonicalSiteDedupeKeyFromFields,
  dedupeByCanonicalDomain,
  inventoryRowPriorityScore,
  isWwwHost,
  mergeDuplicateVariants,
  parseDuplicateVariants,
  variantFromCandidate,
  type DuplicateUrlVariant,
} from "./evalCanonicalDedup";
import { logEvalUrlDedupe } from "./evalUrlDedup";
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
  /** Collapsed www/non-www and other canonical-domain duplicates. */
  duplicateVariants?: DuplicateUrlVariant[];
};

export type UrlInventoryStats = {
  /** URL candidate rows before canonical-domain collapse. */
  totalRawCandidates: number;
  /** Rows shown after canonical-domain collapse. */
  totalCandidates: number;
  uniqueCanonicalSites: number;
  hiddenDuplicateVariants: number;
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
  /** Joined rows before canonical-domain collapse. */
  rawRows: UrlInventoryRow[];
  stats: UrlInventoryStats;
  urlDuplicatesRemoved: number;
};

function mergeSourceColumn(existing: string, next: string): string {
  if (!existing.trim()) return next.trim();
  if (!next.trim()) return existing.trim();
  const parts = existing.split("; ").map((s) => s.trim());
  const add = next.trim();
  if (parts.includes(add)) return existing;
  return `${existing}; ${add}`;
}

function pickBetterInventoryRow(
  primary: UrlInventoryRow,
  secondary: UrlInventoryRow,
): UrlInventoryRow {
  const scoreA = inventoryRowPriorityScore(primary);
  const scoreB = inventoryRowPriorityScore(secondary);
  if (scoreA > scoreB) return primary;
  if (scoreB > scoreA) return secondary;
  const aWww =
    isWwwHost(primary.candidate.domain) ||
    isWwwHost(primary.candidate.normalized_url);
  const bWww =
    isWwwHost(secondary.candidate.domain) ||
    isWwwHost(secondary.candidate.normalized_url);
  if (aWww && !bWww) return secondary;
  if (bWww && !aWww) return primary;
  return primary;
}

function mergeUrlInventoryRows(
  primary: UrlInventoryRow,
  secondary: UrlInventoryRow,
): UrlInventoryRow {
  const kept = pickBetterInventoryRow(primary, secondary);
  const other = kept === primary ? secondary : primary;

  const duplicateVariants = mergeDuplicateVariants(
    [
      ...(primary.duplicateVariants ?? []),
      ...(secondary.duplicateVariants ?? []),
      ...parseDuplicateVariants(kept.review?.duplicate_source_urls),
      ...parseDuplicateVariants(other.review?.duplicate_source_urls),
    ],
    [variantFromCandidate(other.candidate)],
    variantFromCandidate(kept.candidate),
  );

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
    duplicateVariants,
  };
}

function canonicalKeyForInventoryRow(row: UrlInventoryRow): string | null {
  return canonicalSiteDedupeKeyFromFields({
    canonical_domain: row.candidate.canonical_domain,
    domain: row.candidate.domain,
    normalized_url: row.candidate.normalized_url,
    raw_url: row.candidate.raw_url,
  });
}

export function dedupeUrlInventoryRows(
  rows: UrlInventoryRow[],
  logLabel?: string,
  rawCandidateCount?: number,
): UrlInventoryBuildResult {
  const result = dedupeByCanonicalDomain(
    rows,
    canonicalKeyForInventoryRow,
    mergeUrlInventoryRows,
  );
  if (logLabel) {
    logEvalUrlDedupe(logLabel, result);
  }

  const stats = computeUrlInventoryStats(
    result.items,
    rawCandidateCount ?? result.beforeCount,
  );
  return {
    rows: result.items,
    rawRows: rows,
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
  const key = canonicalDomainKeyFromFields({ normalized_url: url });
  return key ? `domain:${key}` : null;
}

function buildReviewIndex(reviewRows: BrandAuditRow[]): Map<string, BrandAuditRow> {
  const index = new Map<string, BrandAuditRow>();

  for (const row of reviewRows) {
    const normalized = row.normalized_url?.trim();
    if (normalized) {
      const urlKey = reviewUrlKey(normalized);
      if (urlKey) index.set(urlKey, row);
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
  const normalized = candidate.normalized_url?.trim();
  if (normalized) {
    const urlKey = reviewUrlKey(normalized);
    if (urlKey) {
      const byUrl = index.get(urlKey);
      if (byUrl) return byUrl;
    }
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

  const deduped = dedupeUrlInventoryRows(rawRows, logLabel, candidates.length);
  return {
    ...deduped,
    rows: applyLatestBatchFlagsToInventoryRows(deduped.rows),
  };
}

export function computeUrlInventoryStats(
  rows: UrlInventoryRow[],
  rawCandidateCount?: number,
): UrlInventoryStats {
  const totalRawCandidates = rawCandidateCount ?? rows.length;
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
  const totalCandidates = rows.length;
  const hiddenDuplicateVariants = Math.max(0, totalRawCandidates - totalCandidates);

  return {
    totalRawCandidates,
    totalCandidates,
    uniqueCanonicalSites: totalCandidates,
    hiddenDuplicateVariants,
    uniqueDomains: domains.size,
    processedCount,
    notRunCount,
    successCount,
    failedCount,
    latestBatchCount,
  };
}
