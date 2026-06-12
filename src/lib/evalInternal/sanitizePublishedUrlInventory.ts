import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";
import type {
  PublishedInternalEvalUrlInventoryFile,
  PublishedUrlInventoryRow,
} from "@/lib/evalLocal/publishedInternalEvalTypes";
import type { UrlCandidateRow } from "@/lib/evalLocal/urlCandidateTypes";
import {
  buildUrlInventory,
  type UrlInventoryRow,
} from "@/lib/evalLocal/urlInventoryJoin";
import { displayUrlHostOnly } from "./sanitizePublishedReview";

export type PublishUrlInventoryOptions = {
  includeDomains: boolean;
  includeProjectContext: boolean;
  includeLogoUrls: boolean;
};

export type PublishUrlInventoryStats = {
  candidatesRead: number;
  rowsPublished: number;
  matchedCount: number;
  notRunCount: number;
  successCount: number;
  failedCount: number;
  urlDuplicatesRemoved: number;
};

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
  return {
    ...sanitizeInventoryCandidateFields(row.candidate, rowIndex, options),
    extraction_status: row.extractionStatus,
    review: row.review,
  };
}

export function buildPublishedUrlInventoryFile(
  sourceUrlCandidatesBasename: string,
  sourceReviewQueueBasename: string,
  candidates: UrlCandidateRow[],
  publishedReviewRows: BrandAuditRow[],
  options: PublishUrlInventoryOptions,
): {
  file: PublishedInternalEvalUrlInventoryFile;
  stats: PublishUrlInventoryStats;
} {
  const { rows: inventoryRows, stats: inventoryStats, urlDuplicatesRemoved } =
    buildUrlInventory(candidates, publishedReviewRows, "Published URL inventory");

  const rows = inventoryRows.map((row, index) =>
    sanitizeUrlInventoryRow(row, index, options),
  );

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
      rows,
    },
    stats: {
      candidatesRead: candidates.length,
      rowsPublished: rows.length,
      matchedCount: inventoryStats.processedCount,
      notRunCount: inventoryStats.notRunCount,
      successCount: inventoryStats.successCount,
      failedCount: inventoryStats.failedCount,
      urlDuplicatesRemoved,
    },
  };
}
