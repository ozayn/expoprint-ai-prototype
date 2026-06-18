import { canonicalDomainFromHost } from "./canonicalDomain";
import type { UrlInventoryRow } from "./urlInventoryJoin";

export type UrlInventorySortMode =
  | "recent"
  | "original"
  | "domain"
  | "status"
  | "needs_work";

export const URL_INVENTORY_SORT_MODES: UrlInventorySortMode[] = [
  "recent",
  "original",
  "domain",
  "status",
  "needs_work",
];

export function parseUrlInventorySortMode(
  value: string | undefined,
): UrlInventorySortMode {
  const v = value?.trim().toLowerCase();
  if (v === "original" || v === "domain" || v === "status" || v === "needs_work") {
    return v;
  }
  return "recent";
}

export function urlInventorySortLabel(mode: UrlInventorySortMode): string {
  switch (mode) {
    case "recent":
      return "Recently processed";
    case "original":
      return "Original inventory order";
    case "domain":
      return "Domain A–Z";
    case "status":
      return "Status";
    case "needs_work":
      return "Missing fields / needs work";
  }
}

export type UrlInventoryQuickFilter = "all" | "recent" | "not_run" | "failed";

export function parseUrlInventoryQuickFilter(
  inventoryParam: string | undefined,
): UrlInventoryQuickFilter {
  const inv = inventoryParam?.trim().toLowerCase();
  if (inv === "recent") return "recent";
  if (inv === "not_run") return "not_run";
  if (inv === "failed") return "failed";
  return "all";
}

function domainKeyForRow(row: UrlInventoryRow): string {
  const candidate = row.candidate;
  const fromCanonical = candidate.canonical_domain?.trim();
  if (fromCanonical) return canonicalDomainFromHost(fromCanonical).toLowerCase();
  const fromDomain = candidate.domain?.trim();
  if (fromDomain) return canonicalDomainFromHost(fromDomain).toLowerCase();
  const url = candidate.normalized_url?.trim();
  if (url) {
    try {
      const parsed = new URL(
        /^https?:\/\//i.test(url) ? url : `https://${url}`,
      );
      return canonicalDomainFromHost(parsed.hostname).toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }
  return "";
}

function statusSortRank(status: UrlInventoryRow["extractionStatus"]): number {
  if (status === "success") return 1;
  if (status === "failed") return 2;
  return 3;
}

function processedTimestamp(row: UrlInventoryRow): number {
  const at = row.processedMeta?.processedAt?.trim();
  if (!at) return 0;
  const ms = Date.parse(at);
  return Number.isNaN(ms) ? 0 : ms;
}

function rowNeedsWork(row: UrlInventoryRow): boolean {
  if (row.extractionStatus === "failed") return true;
  if (row.extractionStatus !== "success") return false;
  const review = row.review;
  if (!review) return false;
  const name = review.extracted_business_name?.trim();
  const logos = review.logo_candidate_urls?.trim();
  const colors = review.extracted_color_hexes?.trim();
  return !name || !logos || !colors;
}

function compareOriginalIndex(a: UrlInventoryRow, b: UrlInventoryRow): number {
  return a.originalIndex - b.originalIndex;
}

export function sortUrlInventoryRows(
  rows: UrlInventoryRow[],
  mode: UrlInventorySortMode,
): UrlInventoryRow[] {
  const sorted = [...rows];

  if (mode === "original") {
    sorted.sort(compareOriginalIndex);
    return sorted;
  }

  if (mode === "domain") {
    sorted.sort((a, b) => {
      const da = domainKeyForRow(a);
      const db = domainKeyForRow(b);
      const cmp = da.localeCompare(db);
      return cmp !== 0 ? cmp : compareOriginalIndex(a, b);
    });
    return sorted;
  }

  if (mode === "status") {
    sorted.sort((a, b) => {
      const cmp =
        statusSortRank(a.extractionStatus) - statusSortRank(b.extractionStatus);
      return cmp !== 0 ? cmp : compareOriginalIndex(a, b);
    });
    return sorted;
  }

  if (mode === "needs_work") {
    sorted.sort((a, b) => {
      const aw = rowNeedsWork(a) ? 0 : 1;
      const bw = rowNeedsWork(b) ? 0 : 1;
      if (aw !== bw) return aw - bw;
      return compareOriginalIndex(a, b);
    });
    return sorted;
  }

  // recent (default): processed newest first, then not-run in original order
  sorted.sort((a, b) => {
    const aProcessed = a.extractionStatus !== "not_run";
    const bProcessed = b.extractionStatus !== "not_run";
    if (aProcessed !== bProcessed) return aProcessed ? -1 : 1;
    if (aProcessed && bProcessed) {
      const ta = processedTimestamp(a);
      const tb = processedTimestamp(b);
      if (ta !== tb) return tb - ta;
      return compareOriginalIndex(a, b);
    }
    return compareOriginalIndex(a, b);
  });

  return sorted;
}

export function filterUrlInventoryQuick(
  rows: UrlInventoryRow[],
  filter: UrlInventoryQuickFilter,
): UrlInventoryRow[] {
  if (filter === "all") return rows;
  if (filter === "recent") {
    return rows.filter(
      (row) =>
        row.processedMeta?.sourceReviewQueue ||
        row.extractionStatus !== "not_run",
    );
  }
  if (filter === "not_run") {
    return rows.filter((row) => row.extractionStatus === "not_run");
  }
  return rows.filter((row) => row.extractionStatus === "failed");
}

export function countLatestBatchRows(rows: UrlInventoryRow[]): number {
  return rows.filter((row) => row.processedMeta?.isLatestBatch).length;
}
