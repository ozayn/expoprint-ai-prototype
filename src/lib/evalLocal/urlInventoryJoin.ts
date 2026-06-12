import type { BrandAuditRow } from "./brandAuditRow";
import { canonicalDomainFromHost } from "./canonicalDomain";
import type { UrlCandidateRow } from "./urlCandidateTypes";

export type UrlInventoryExtractionStatus = "not_run" | "success" | "failed";

export type UrlInventoryRow = {
  candidate: UrlCandidateRow;
  extractionStatus: UrlInventoryExtractionStatus;
  review: BrandAuditRow | null;
};

export type UrlInventoryStats = {
  totalCandidates: number;
  uniqueDomains: number;
  processedCount: number;
  notRunCount: number;
  successCount: number;
  failedCount: number;
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

function urlKey(url: string): string {
  return url.trim().toLowerCase();
}

function reviewExtractionStatus(review: BrandAuditRow): UrlInventoryExtractionStatus {
  const status = review.status?.trim() ?? "";
  if (status === "success") return "success";
  if (status) return "failed";
  return "failed";
}

function buildReviewIndex(reviewRows: BrandAuditRow[]): Map<string, BrandAuditRow> {
  const index = new Map<string, BrandAuditRow>();

  for (const row of reviewRows) {
    const normalized = row.normalized_url?.trim();
    if (normalized) {
      index.set(`url:${urlKey(normalized)}`, row);
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
    const byUrl = index.get(`url:${urlKey(normalized)}`);
    if (byUrl) return byUrl;
  }

  const canonical = canonicalForCandidate(candidate);
  if (canonical) {
    const byDomain = index.get(`domain:${canonical}`);
    if (byDomain) return byDomain;
  }

  return null;
}

export function buildUrlInventory(
  candidates: UrlCandidateRow[],
  reviewRows: BrandAuditRow[],
): { rows: UrlInventoryRow[]; stats: UrlInventoryStats } {
  const index = buildReviewIndex(reviewRows);
  const rows: UrlInventoryRow[] = candidates.map((candidate) => {
    const review = findReviewForCandidate(candidate, index);
    const extractionStatus: UrlInventoryExtractionStatus = review
      ? reviewExtractionStatus(review)
      : "not_run";
    return { candidate, extractionStatus, review };
  });

  const stats = computeUrlInventoryStats(rows);
  return { rows, stats };
}

export function computeUrlInventoryStats(
  rows: UrlInventoryRow[],
): UrlInventoryStats {
  const domains = new Set<string>();
  let notRunCount = 0;
  let successCount = 0;
  let failedCount = 0;

  for (const row of rows) {
    const canonical = canonicalForCandidate(row.candidate);
    if (canonical) domains.add(canonical);

    if (row.extractionStatus === "not_run") notRunCount += 1;
    else if (row.extractionStatus === "success") successCount += 1;
    else failedCount += 1;
  }

  const processedCount = successCount + failedCount;

  return {
    totalCandidates: rows.length,
    uniqueDomains: domains.size,
    processedCount,
    notRunCount,
    successCount,
    failedCount,
  };
}
