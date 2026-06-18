import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";
import type {
  PublishedInternalEvalUrlInventoryFile,
  PublishedUrlInventoryRow,
} from "@/lib/evalLocal/publishedInternalEvalTypes";
import type { UrlCandidateRow } from "@/lib/evalLocal/urlCandidateTypes";
import {
  canonicalSiteDedupeKeyFromFields,
  dedupeByCanonicalDomain,
  mergeDuplicateVariants,
  parseDuplicateVariants,
  serializeDuplicateVariants,
} from "@/lib/evalLocal/evalCanonicalDedup";
import { logEvalUrlDedupe } from "@/lib/evalLocal/evalUrlDedup";
import {
  buildUrlInventory,
  type UrlInventoryExtractionStatus,
  type UrlInventoryRow,
} from "@/lib/evalLocal/urlInventoryJoin";
import {
  evalRunIdToIso,
  resolveSourceReviewQueueFromReview,
} from "@/lib/evalLocal/evalProcessedMeta";
import { isCombinedReviewQueueFilename } from "@/lib/evalLocal/evalReviewQueueFiles";
import { displayUrlHostOnly } from "./sanitizePublishedReview";

export type PublishUrlInventoryOptions = {
  includeDomains: boolean;
  includeProjectContext: boolean;
  includeLogoUrls: boolean;
};

export type PublishUrlInventoryStats = {
  candidatesRead: number;
  inventoryRowsAfterDedupe: number;
  sanitizedRows: number;
  rowsPublished: number;
  matchedCount: number;
  notRunCount: number;
  successCount: number;
  failedCount: number;
  urlDuplicatesRemoved: number;
  publishDuplicatesRemoved: number;
};

function mergeSourceColumn(existing: string, next: string): string {
  if (!existing.trim()) return next.trim();
  if (!next.trim()) return existing.trim();
  const parts = existing.split("; ").map((s) => s.trim());
  const add = next.trim();
  if (parts.includes(add)) return existing;
  return `${existing}; ${add}`;
}

function extractionStatusRank(status: UrlInventoryExtractionStatus): number {
  if (status === "success") return 3;
  if (status === "failed") return 2;
  return 1;
}

function publishedRowCanonicalKey(row: PublishedUrlInventoryRow): string {
  const key = canonicalSiteDedupeKeyFromFields({
    canonical_domain: row.canonical_domain,
    domain: row.domain,
    normalized_url: row.normalized_url,
  });
  if (key) return key;
  return row.row_label?.trim() || "";
}

function mergePublishedUrlInventoryRows(
  primary: PublishedUrlInventoryRow,
  secondary: PublishedUrlInventoryRow,
): PublishedUrlInventoryRow {
  const primaryRank = extractionStatusRank(primary.extraction_status);
  const secondaryRank = extractionStatusRank(secondary.extraction_status);
  const kept = primaryRank >= secondaryRank ? primary : secondary;
  const other = primaryRank >= secondaryRank ? secondary : primary;

  const merged: PublishedUrlInventoryRow = {
    ...kept,
    source_column: mergeSourceColumn(
      kept.source_column ?? "",
      other.source_column ?? "",
    ),
    review: kept.review ?? other.review,
  };

  const keptSource = kept.source_review_queue?.trim();
  const otherSource = other.source_review_queue?.trim();
  if (
    keptSource &&
    !isCombinedReviewQueueFilename(keptSource)
  ) {
    merged.source_review_queue = keptSource;
  } else if (
    otherSource &&
    !isCombinedReviewQueueFilename(otherSource)
  ) {
    merged.source_review_queue = otherSource;
  }

  merged.extraction_run_id =
    kept.extraction_run_id?.trim() || other.extraction_run_id?.trim() || undefined;
  merged.processed_at =
    kept.processed_at?.trim() || other.processed_at?.trim() || undefined;

  const variants = mergeDuplicateVariants(
    [
      ...parseDuplicateVariants(primary.duplicate_source_urls),
      ...parseDuplicateVariants(secondary.duplicate_source_urls),
    ],
    [
      {
        normalized_url: other.normalized_url?.trim() || undefined,
        domain: other.domain?.trim() || undefined,
        canonical_domain: other.canonical_domain?.trim() || undefined,
      },
    ],
    {
      normalized_url: kept.normalized_url?.trim() || undefined,
      domain: kept.domain?.trim() || undefined,
      canonical_domain: kept.canonical_domain?.trim() || undefined,
    },
  );
  if (variants.length > 0) {
    merged.duplicate_source_urls = serializeDuplicateVariants(variants);
  }

  return merged;
}

/** Deduplicate sanitized published rows (e.g. after host-only normalized_url collisions). */
export function dedupePublishedUrlInventoryRows(
  rows: PublishedUrlInventoryRow[],
  logLabel?: string,
): { rows: PublishedUrlInventoryRow[]; duplicatesRemoved: number } {
  const result = dedupeByCanonicalDomain(
    rows,
    (row) => publishedRowCanonicalKey(row) || null,
    mergePublishedUrlInventoryRows,
  );
  if (logLabel) {
    logEvalUrlDedupe(logLabel, result);
  }
  return { rows: result.items, duplicatesRemoved: result.duplicatesRemoved };
}

function statsFromPublishedRows(rows: PublishedUrlInventoryRow[]): {
  matchedCount: number;
  notRunCount: number;
  successCount: number;
  failedCount: number;
} {
  let notRunCount = 0;
  let successCount = 0;
  let failedCount = 0;

  for (const row of rows) {
    if (row.extraction_status === "not_run") notRunCount += 1;
    else if (row.extraction_status === "success") successCount += 1;
    else failedCount += 1;
  }

  return {
    matchedCount: successCount + failedCount,
    notRunCount,
    successCount,
    failedCount,
  };
}

function sanitizeInventoryCandidateFields(
  candidate: UrlCandidateRow,
  rowIndex: number,
  options: PublishUrlInventoryOptions,
): Pick<
  PublishedUrlInventoryRow,
  | "row_label"
  | "canonical_domain"
  | "domain"
  | "normalized_url"
  | "project_title"
  | "project_type"
  | "source_column"
> {
  const rowLabel = options.includeDomains
    ? candidate.canonical_domain?.trim() ||
      candidate.domain?.trim() ||
      displayUrlHostOnly(candidate.normalized_url ?? "") ||
      `URL ${rowIndex + 1}`
    : `URL ${rowIndex + 1}`;

  const sourceColumn = candidate.source_column?.trim();

  const out: Pick<
    PublishedUrlInventoryRow,
    | "row_label"
    | "canonical_domain"
    | "domain"
    | "normalized_url"
    | "project_title"
    | "project_type"
    | "source_column"
  > = {
    row_label: rowLabel,
  };

  if (sourceColumn) {
    out.source_column = sourceColumn;
  }

  const projectType = candidate.project_type?.trim();
  if (projectType) {
    out.project_type = projectType;
  }

  if (options.includeProjectContext) {
    const title = candidate.project_title?.trim();
    if (title) {
      out.project_title = title;
    }
  }

  if (options.includeDomains) {
    const canonical = candidate.canonical_domain?.trim();
    const domain = candidate.domain?.trim();
    const displayUrl = displayUrlHostOnly(candidate.normalized_url ?? "");

    if (canonical) {
      out.canonical_domain = canonical;
    }
    if (domain) {
      out.domain = domain;
    }
    if (displayUrl) {
      out.normalized_url = displayUrl;
    }
  }

  return out;
}

export function sanitizeUrlInventoryRow(
  row: UrlInventoryRow,
  rowIndex: number,
  options: PublishUrlInventoryOptions,
): PublishedUrlInventoryRow {
  const published: PublishedUrlInventoryRow = {
    ...sanitizeInventoryCandidateFields(row.candidate, rowIndex, options),
    extraction_status: row.extractionStatus,
    review: row.review,
  };

  const batchSource = row.review
    ? resolveSourceReviewQueueFromReview(row.review)
    : "";
  const meta = row.processedMeta;

  if (batchSource) {
    published.source_review_queue = batchSource;
  } else if (
    meta?.sourceReviewQueue &&
    !isCombinedReviewQueueFilename(meta.sourceReviewQueue)
  ) {
    published.source_review_queue = meta.sourceReviewQueue;
  }

  const extractionRunId =
    row.review?.extraction_run_id?.trim() ||
    meta?.extractionRunId?.trim() ||
    "";
  if (extractionRunId) {
    published.extraction_run_id = extractionRunId;
  }

  const processedAt =
    row.review?.processed_at?.trim() || meta?.processedAt?.trim() || "";
  if (processedAt) {
    published.processed_at = processedAt;
  } else if (extractionRunId) {
    const inferred = evalRunIdToIso(extractionRunId);
    if (inferred) published.processed_at = inferred;
  }

  if (published.review && batchSource) {
    published.review = {
      ...published.review,
      source_review_queue: batchSource,
      extraction_run_id: extractionRunId || published.review.extraction_run_id,
      processed_at: published.processed_at || published.review.processed_at,
    };
  }

  if (row.duplicateVariants?.length) {
    published.duplicate_source_urls = serializeDuplicateVariants(
      row.duplicateVariants,
    );
  }

  return published;
}

export function logPublishUrlInventoryRowCounts(
  label: string,
  counts: {
    rawInventoryRows: number;
    afterInitialDedupe: number;
    afterSanitization: number;
    finalWritten: number;
    initialDuplicatesRemoved: number;
    publishDuplicatesRemoved: number;
  },
): void {
  console.log(`${label} row counts:`);
  console.log(`  Raw inventory rows:        ${counts.rawInventoryRows}`);
  console.log(`  After initial URL dedupe:  ${counts.afterInitialDedupe}`);
  console.log(`  After publish sanitization: ${counts.afterSanitization}`);
  console.log(`  Final written rows:        ${counts.finalWritten}`);
  if (counts.initialDuplicatesRemoved > 0) {
    console.log(
      `  Initial dedupe removed:    ${counts.initialDuplicatesRemoved}`,
    );
  }
  if (counts.publishDuplicatesRemoved > 0) {
    console.log(
      `  Publish dedupe removed:    ${counts.publishDuplicatesRemoved}`,
    );
  }
}

export function buildPublishedUrlInventoryFile(
  sourceUrlCandidatesBasename: string,
  sourceReviewQueueBasename: string,
  candidates: UrlCandidateRow[],
  publishedReviewRows: BrandAuditRow[],
  options: PublishUrlInventoryOptions,
  logCounts = true,
): {
  file: PublishedInternalEvalUrlInventoryFile;
  stats: PublishUrlInventoryStats;
} {
  const { rows: inventoryRows, urlDuplicatesRemoved } = buildUrlInventory(
    candidates,
    publishedReviewRows,
    "Published URL inventory",
    {
      reviewQueueFilename: sourceReviewQueueBasename,
    },
  );

  const sanitizedRows = inventoryRows.map((row, index) =>
    sanitizeUrlInventoryRow(row, index, options),
  );

  const { rows: finalRows, duplicatesRemoved: publishDuplicatesRemoved } =
    dedupePublishedUrlInventoryRows(
      sanitizedRows,
      "Published URL inventory (post-sanitize)",
    );

  const extractionStats = statsFromPublishedRows(finalRows);

  if (logCounts) {
    logPublishUrlInventoryRowCounts("URL inventory publish", {
      rawInventoryRows: candidates.length,
      afterInitialDedupe: inventoryRows.length,
      afterSanitization: sanitizedRows.length,
      finalWritten: finalRows.length,
      initialDuplicatesRemoved: urlDuplicatesRemoved,
      publishDuplicatesRemoved,
    });
  }

  return {
    file: {
      description:
        "Sanitized published URL inventory for /internal/eval. No partner IDs, requirement text, or raw database excerpts.",
      published_at: new Date().toISOString(),
      source_url_candidates: sourceUrlCandidatesBasename,
      source_review_queue: sourceReviewQueueBasename,
      include_domains: options.includeDomains,
      include_project_context: options.includeProjectContext,
      include_logo_urls: options.includeLogoUrls,
      rows: finalRows,
    },
    stats: {
      candidatesRead: candidates.length,
      inventoryRowsAfterDedupe: inventoryRows.length,
      sanitizedRows: sanitizedRows.length,
      rowsPublished: finalRows.length,
      matchedCount: extractionStats.matchedCount,
      notRunCount: extractionStats.notRunCount,
      successCount: extractionStats.successCount,
      failedCount: extractionStats.failedCount,
      urlDuplicatesRemoved,
      publishDuplicatesRemoved,
    },
  };
}
