import type { BrandAuditRow } from "./brandAuditRow";
import { BRAND_AUDIT_EXTRACTED_FIELDS } from "./brandAuditRow";
import { canonicalDomainFromHost } from "./canonicalDomain";
import {
  evalRunIdToIso,
  extractionRunIdFromReviewQueueName,
} from "./evalProcessedMeta";
import { normalizeStatusValue, type EvalNormalizedStatus } from "./normalizeEvalStatus";
import {
  hasPlausibleAddressForMerge,
  shouldPreserveRicherContact,
} from "./reviewRowMergeQuality";
import type { ReviewQueueRow } from "./reviewQueueTypes";
import type { UrlCandidateRow } from "./urlCandidateTypes";

type InventoryExtractionStatus = "not_run" | "success" | "failed";

export type DuplicateUrlVariant = {
  normalized_url?: string;
  domain?: string;
  canonical_domain?: string;
  raw_url?: string;
  source_column?: string;
};

export type CanonicalDedupeResult<T> = {
  items: T[];
  beforeCount: number;
  afterCount: number;
  duplicatesRemoved: number;
};

export function canonicalDomainKeyFromFields(fields: {
  canonical_domain?: string;
  domain?: string;
  normalized_url?: string;
  raw_url?: string;
}): string | null {
  const fromCanonical = fields.canonical_domain?.trim();
  if (fromCanonical) return canonicalDomainFromHost(fromCanonical);

  const fromDomain = fields.domain?.trim();
  if (fromDomain) return canonicalDomainFromHost(fromDomain);

  const fromNormalized = hostFromUrlish(fields.normalized_url);
  if (fromNormalized) return canonicalDomainFromHost(fromNormalized);

  const fromRaw = hostFromUrlish(fields.raw_url);
  if (fromRaw) return canonicalDomainFromHost(fromRaw);

  return null;
}

/**
 * Dedupe key for site-level URLs: collapses www/non-www on the same path,
 * but keeps distinct paths on the same registrable domain separate.
 */
export function canonicalSiteDedupeKeyFromFields(fields: {
  canonical_domain?: string;
  domain?: string;
  normalized_url?: string;
  raw_url?: string;
}): string | null {
  const canonical = canonicalDomainKeyFromFields(fields);
  const normalized =
    fields.normalized_url?.trim() || fields.raw_url?.trim() || "";
  if (!normalized) {
    return canonical ? `site:${canonical}` : null;
  }

  try {
    const href = /^https?:\/\//i.test(normalized)
      ? normalized
      : `https://${normalized}`;
    const parsed = new URL(href);
    const hostCanonical = canonicalDomainFromHost(parsed.hostname);
    let pathname = parsed.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.replace(/\/+$/, "");
    }
    const search = parsed.search;
    if (!pathname || pathname === "/") {
      return `site:${hostCanonical || canonical || ""}`;
    }
    const site = hostCanonical || canonical;
    if (!site) return null;
    return `path:${site}${pathname}${search}`;
  } catch {
    return canonical ? `site:${canonical}` : null;
  }
}

function hostFromUrlish(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  try {
    const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(href).hostname;
  } catch {
    return trimmed.replace(/^www\./i, "").split("/")[0] ?? "";
  }
}

export function isWwwHost(value: string | undefined): boolean {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed.startsWith("www.")) return true;
  try {
    const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(href).hostname.toLowerCase().startsWith("www.");
  } catch {
    return false;
  }
}

export function countBrandAuditExtractedFields(row: BrandAuditRow): number {
  let count = 0;
  for (const field of BRAND_AUDIT_EXTRACTED_FIELDS) {
    if (row[field]?.trim()) count += 1;
  }
  return count;
}

function reviewRowOutcome(row: ReviewQueueRow): EvalNormalizedStatus {
  const status = row.status?.trim();
  if (!status) return "not_run";
  return normalizeStatusValue(status);
}

function outcomeRank(outcome: EvalNormalizedStatus): number {
  switch (outcome) {
    case "success":
      return 3;
    case "failed":
      return 2;
    case "not_run":
      return 1;
  }
}

function extractionStatusRank(status: InventoryExtractionStatus): number {
  if (status === "success") return 3;
  if (status === "failed") return 2;
  return 1;
}

function reviewRowProcessed(row: ReviewQueueRow): boolean {
  return Boolean(row.status?.trim());
}

function reviewRowSortTimestamp(row: ReviewQueueRow): number {
  const processedAt = row.processed_at?.trim();
  if (processedAt) {
    const ms = Date.parse(processedAt);
    if (!Number.isNaN(ms)) return ms;
  }

  const runId =
    row.extraction_run_id?.trim() ||
    extractionRunIdFromReviewQueueName(row.source_review_queue ?? "");
  if (runId) {
    const iso = evalRunIdToIso(runId);
    if (iso) {
      const ms = Date.parse(iso);
      if (!Number.isNaN(ms)) return ms;
    }
    const numeric = Number(runId);
    if (!Number.isNaN(numeric)) return numeric;
  }

  const queue = row.source_review_queue?.trim();
  if (queue) {
    const fromQueue = extractionRunIdFromReviewQueueName(queue);
    if (fromQueue) {
      const iso = evalRunIdToIso(fromQueue);
      if (iso) {
        const ms = Date.parse(iso);
        if (!Number.isNaN(ms)) return ms;
      }
    }
  }

  return 0;
}

function reviewRowPriorityScore(row: ReviewQueueRow): number {
  let score = 0;
  if (reviewRowProcessed(row)) score += 1_000_000;
  if (row.status?.trim() === "success") score += 500_000;
  else if (reviewRowProcessed(row)) score += 200_000;
  score += countBrandAuditExtractedFields(row) * 1_000;
  score += reviewRowSortTimestamp(row);
  if (!isWwwHost(row.domain) && !isWwwHost(row.normalized_url)) score += 1;
  return score;
}

function pickBetterSuccessReviewRow(
  a: ReviewQueueRow,
  b: ReviewQueueRow,
): ReviewQueueRow {
  const tsA = reviewRowSortTimestamp(a);
  const tsB = reviewRowSortTimestamp(b);
  let newer: ReviewQueueRow = a;
  let older: ReviewQueueRow = b;

  if (tsB > tsA) {
    newer = b;
    older = a;
  } else if (tsA === tsB && reviewRowPriorityScore(b) > reviewRowPriorityScore(a)) {
    newer = b;
    older = a;
  }

  if (shouldPreserveRicherContact(older, newer)) {
    return older;
  }

  return newer;
}

export function pickBetterReviewRow(
  a: ReviewQueueRow,
  b: ReviewQueueRow,
): ReviewQueueRow {
  const outcomeA = reviewRowOutcome(a);
  const outcomeB = reviewRowOutcome(b);
  const rankA = outcomeRank(outcomeA);
  const rankB = outcomeRank(outcomeB);

  if (rankA !== rankB) {
    return rankA > rankB ? a : b;
  }

  if (outcomeA === "success" && outcomeB === "success") {
    return pickBetterSuccessReviewRow(a, b);
  }

  const tsA = reviewRowSortTimestamp(a);
  const tsB = reviewRowSortTimestamp(b);
  if (tsA !== tsB) {
    return tsA > tsB ? a : b;
  }

  const scoreA = reviewRowPriorityScore(a);
  const scoreB = reviewRowPriorityScore(b);
  if (scoreA > scoreB) return a;
  if (scoreB > scoreA) return b;
  return preferNonWwwReviewRow(a, b);
}

function preferNonWwwReviewRow(a: ReviewQueueRow, b: ReviewQueueRow): ReviewQueueRow {
  const aWww = isWwwHost(a.domain) || isWwwHost(a.normalized_url);
  const bWww = isWwwHost(b.domain) || isWwwHost(b.normalized_url);
  if (aWww && !bWww) return b;
  if (bWww && !aWww) return a;
  return a;
}

export function variantFromReviewRow(row: ReviewQueueRow): DuplicateUrlVariant {
  return {
    normalized_url: row.normalized_url?.trim() || undefined,
    domain: row.domain?.trim() || undefined,
    canonical_domain: row.canonical_domain?.trim() || undefined,
    source_column: row.source_column?.trim() || undefined,
  };
}

export function variantFromCandidate(candidate: UrlCandidateRow): DuplicateUrlVariant {
  return {
    normalized_url: candidate.normalized_url?.trim() || undefined,
    domain: candidate.domain?.trim() || undefined,
    canonical_domain: candidate.canonical_domain?.trim() || undefined,
    raw_url: candidate.raw_url?.trim() || undefined,
    source_column: candidate.source_column?.trim() || undefined,
  };
}

function variantKey(variant: DuplicateUrlVariant): string {
  const normalized = variant.normalized_url?.trim().toLowerCase();
  if (normalized) return `url:${normalized}`;
  const domain = variant.domain?.trim().toLowerCase();
  if (domain) return `domain:${domain}`;
  const raw = variant.raw_url?.trim().toLowerCase();
  if (raw) return `raw:${raw}`;
  return "";
}

export function parseDuplicateVariants(json: string | undefined): DuplicateUrlVariant[] {
  const trimmed = json?.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: DuplicateUrlVariant[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      out.push({
        normalized_url:
          typeof record.normalized_url === "string"
            ? record.normalized_url
            : undefined,
        domain: typeof record.domain === "string" ? record.domain : undefined,
        canonical_domain:
          typeof record.canonical_domain === "string"
            ? record.canonical_domain
            : undefined,
        raw_url: typeof record.raw_url === "string" ? record.raw_url : undefined,
        source_column:
          typeof record.source_column === "string"
            ? record.source_column
            : undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function serializeDuplicateVariants(variants: DuplicateUrlVariant[]): string {
  if (variants.length === 0) return "";
  return JSON.stringify(variants);
}

export function mergeDuplicateVariants(
  existing: DuplicateUrlVariant[],
  additions: DuplicateUrlVariant[],
  keptVariant?: DuplicateUrlVariant,
): DuplicateUrlVariant[] {
  const seen = new Set<string>();
  const merged: DuplicateUrlVariant[] = [];

  const push = (variant: DuplicateUrlVariant) => {
    const key = variantKey(variant);
    if (!key || seen.has(key)) return;
    if (
      keptVariant &&
      variantKey(keptVariant) &&
      variantKey(keptVariant) === key
    ) {
      return;
    }
    seen.add(key);
    merged.push(variant);
  };

  for (const variant of existing) push(variant);
  for (const variant of additions) push(variant);

  return merged;
}

export function formatDuplicateVariantsForDisplay(
  variants: DuplicateUrlVariant[],
): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const variant of variants) {
    const label =
      variant.normalized_url?.trim() ||
      variant.domain?.trim() ||
      variant.raw_url?.trim() ||
      variant.canonical_domain?.trim() ||
      "";
    const key = label.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

export function dedupeByCanonicalDomain<T>(
  items: T[],
  getKey: (item: T) => string | null,
  merge?: (existing: T, duplicate: T) => T,
): CanonicalDedupeResult<T> {
  const beforeCount = items.length;
  const seen = new Map<string, T>();

  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;

    const existing = seen.get(key);
    if (existing) {
      seen.set(key, merge ? merge(existing, item) : existing);
      continue;
    }

    seen.set(key, item);
  }

  const deduped = [...seen.values()];
  return {
    items: deduped,
    beforeCount,
    afterCount: deduped.length,
    duplicatesRemoved: beforeCount - deduped.length,
  };
}

export function dedupeBrandAuditRows(rows: BrandAuditRow[]): CanonicalDedupeResult<BrandAuditRow> {
  return dedupeByCanonicalDomain(
    rows,
    (row) =>
      canonicalSiteDedupeKeyFromFields({
        canonical_domain: row.canonical_domain,
        domain: row.domain,
        normalized_url: row.normalized_url,
      }),
    mergeBrandAuditRows,
  );
}

export function mergeBrandAuditRows(
  primary: BrandAuditRow,
  secondary: BrandAuditRow,
): BrandAuditRow {
  const kept = pickBetterReviewRow(primary, secondary);
  const other = kept === primary ? secondary : primary;

  const variants = mergeDuplicateVariants(
    parseDuplicateVariants(kept.duplicate_source_urls),
    [
      ...parseDuplicateVariants(other.duplicate_source_urls),
      variantFromReviewRow(other),
    ],
    variantFromReviewRow(kept),
  );

  const merged: BrandAuditRow = { ...kept };
  if (!merged.source_review_queue?.trim()) {
    merged.source_review_queue = other.source_review_queue?.trim() ?? "";
  }
  if (!merged.extraction_run_id?.trim()) {
    merged.extraction_run_id = other.extraction_run_id?.trim() ?? "";
  }
  if (!merged.processed_at?.trim()) {
    merged.processed_at = other.processed_at?.trim() ?? "";
  }
  if (!merged.extraction_run_id?.trim() && merged.source_review_queue?.trim()) {
    const inferred = extractionRunIdFromReviewQueueName(merged.source_review_queue);
    if (inferred) merged.extraction_run_id = inferred;
  }
  if (!merged.processed_at?.trim() && merged.extraction_run_id?.trim()) {
    const inferred = evalRunIdToIso(merged.extraction_run_id);
    if (inferred) merged.processed_at = inferred;
  }

  const fillFromOther: (keyof BrandAuditRow)[] = [
    "palette_source",
    "palette_confidence",
    "extracted_color_hexes",
    "primary_color_hex",
    "secondary_color_hex",
    "extracted_business_name",
    "extracted_summary",
    "logo_candidate_count",
    "selected_logo_url",
    "logo_candidate_urls",
    "extracted_emails",
    "extracted_phone_numbers",
    "extracted_addresses",
    "extracted_social_links",
    "extracted_contact_links",
  ];
  for (const key of fillFromOther) {
    if (key === "extracted_addresses") {
      if (
        !hasPlausibleAddressForMerge(merged) &&
        hasPlausibleAddressForMerge(other)
      ) {
        merged.extracted_addresses = other.extracted_addresses;
      }
      continue;
    }
    if (!merged[key]?.trim() && other[key]?.trim()) {
      merged[key] = other[key];
    }
  }

  merged.duplicate_source_urls = serializeDuplicateVariants(variants);
  return merged;
}

export function inventoryRowPriorityScore(row: {
  extractionStatus: InventoryExtractionStatus;
  review: BrandAuditRow | null;
  candidate: UrlCandidateRow;
}): number {
  let score = 0;
  if (row.extractionStatus !== "not_run") score += 1_000_000;
  score += extractionStatusRank(row.extractionStatus) * 500_000;
  if (row.review) {
    score += reviewRowPriorityScore(row.review);
  }
  if (
    !isWwwHost(row.candidate.domain) &&
    !isWwwHost(row.candidate.normalized_url)
  ) {
    score += 1;
  }
  return score;
}
