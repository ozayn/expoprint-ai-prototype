import type { BrandAuditRow } from "./brandAuditRow";
import { brandAuditSearchHaystack, matchesSearchQuery } from "./evalRowSearch";
import {
  matchesFieldFilters,
  type FieldFilterId,
} from "./fieldCoverageHelpers";
import { normalizeEvalStatus, type EvalNormalizedStatus } from "./normalizeEvalStatus";
import type { UrlInventoryExtractionStatus } from "./urlInventoryJoin";
import type { UrlInventoryRow } from "./urlInventoryJoin";

export type EvalStatusFilter = "all" | EvalNormalizedStatus;

export function extractionStatusForFieldFilters(
  normalized: EvalNormalizedStatus,
): UrlInventoryExtractionStatus {
  if (normalized === "success") return "success";
  if (normalized === "failed") return "failed";
  return "not_run";
}

export function normalizedStatusFromReviewRow(row: BrandAuditRow): EvalNormalizedStatus {
  return normalizeEvalStatus({ status: row.status });
}

export function normalizedStatusFromInventoryRow(row: UrlInventoryRow): EvalNormalizedStatus {
  return normalizeEvalStatus({
    status: row.review?.status,
    extractionStatus: row.extractionStatus,
  });
}

export type EvalRowFilterInput = {
  search: string;
  statusFilter: EvalStatusFilter;
  fieldFilters: FieldFilterId[];
};

export function filterBrandAuditRows(
  rows: BrandAuditRow[],
  filters: EvalRowFilterInput,
): BrandAuditRow[] {
  const { search, statusFilter, fieldFilters } = filters;
  if (
    statusFilter === "all" &&
    !search.trim() &&
    fieldFilters.length === 0
  ) {
    return rows;
  }

  return rows.filter((row) => {
    const normalized = normalizedStatusFromReviewRow(row);
    if (statusFilter !== "all" && normalized !== statusFilter) {
      return false;
    }
    if (!matchesSearchQuery(brandAuditSearchHaystack(row), search)) {
      return false;
    }
    if (
      !matchesFieldFilters(row, fieldFilters, {
        extractionStatus: extractionStatusForFieldFilters(normalized),
      })
    ) {
      return false;
    }
    return true;
  });
}

export function countBrandAuditRowsByStatus(
  rows: BrandAuditRow[],
): Record<EvalNormalizedStatus, number> {
  const counts: Record<EvalNormalizedStatus, number> = {
    success: 0,
    failed: 0,
    not_run: 0,
  };
  for (const row of rows) {
    counts[normalizedStatusFromReviewRow(row)] += 1;
  }
  return counts;
}

export function countInventoryRowsByStatus(
  rows: UrlInventoryRow[],
): Record<EvalNormalizedStatus, number> {
  const counts: Record<EvalNormalizedStatus, number> = {
    success: 0,
    failed: 0,
    not_run: 0,
  };
  for (const row of rows) {
    counts[normalizedStatusFromInventoryRow(row)] += 1;
  }
  return counts;
}

export function filterUrlInventoryRows(
  rows: UrlInventoryRow[],
  filters: EvalRowFilterInput,
  options?: { omitPartnerFields?: boolean },
): UrlInventoryRow[] {
  const { search, statusFilter, fieldFilters } = filters;
  const omitPartner = options?.omitPartnerFields ?? false;

  return rows.filter((row) => {
    const normalized = normalizedStatusFromInventoryRow(row);
    if (statusFilter !== "all" && normalized !== statusFilter) {
      return false;
    }
    if (!matchesSearchQuery(searchHaystackForInventoryRow(row, omitPartner), search)) {
      return false;
    }
    if (
      !matchesFieldFilters(row.review, fieldFilters, {
        extractionStatus: extractionStatusForFieldFilters(normalized),
      })
    ) {
      return false;
    }
    return true;
  });
}

function searchHaystackForInventoryRow(
  row: UrlInventoryRow,
  omitPartnerFields = false,
): string {
  const candidate = row.candidate;
  const review = row.review;
  return [
    candidate.domain,
    candidate.canonical_domain,
    candidate.normalized_url,
    candidate.project_title,
    candidate.project_type,
    omitPartnerFields ? "" : candidate.ds_number,
    omitPartnerFields ? "" : candidate.shop_code,
    review?.extracted_business_name,
  ]
    .map((v) => (v ?? "").toLowerCase())
    .join(" ");
}
