import { canonicalDomainFromHost } from "@/lib/evalLocal/canonicalDomain";
import {
  colorEntriesForRow,
  logoCandidatesForRow,
  parseLogoCandidatesJson,
} from "@/lib/evalLocal/brandExtractionParse";
import {
  emptyBrandAuditRow,
  type BrandAuditRow,
} from "@/lib/evalLocal/brandAuditRow";
import type { PublishedInternalEvalFile } from "@/lib/evalLocal/publishedInternalEvalTypes";

export type { PublishedInternalEvalFile } from "@/lib/evalLocal/publishedInternalEvalTypes";

export type PublishSanitizeOptions = {
  includeDomains: boolean;
  includeLogoUrls: boolean;
};

export type PublishSanitizeStats = {
  rowsRead: number;
  rowsPublished: number;
  rowsWithLogos: number;
  rowsWithPalettes: number;
};

/** Redact URLs and obvious path fragments from error text for published artifacts. */
export function sanitizePublishedErrorMessage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/https?:\/\/[^\s)]+/gi, "[url]")
    .replace(/[a-z0-9-]+\.(com|net|org|io)\/[^\s)]+/gi, "[path]")
    .trim();
}

/** Host-only display URL: `https://example.com` with no path, query, or hash. */
export function displayUrlHostOnly(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  try {
    const withScheme = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withScheme);
    if (!parsed.hostname) return "";
    const host = canonicalDomainFromHost(parsed.hostname);
    return host ? `https://${host}` : "";
  } catch {
    const hostish = trimmed
      .replace(/^https?:\/\//i, "")
      .split(/[/?#]/)[0]
      ?.trim()
      .toLowerCase();
    if (!hostish) return "";
    return `https://${hostish.replace(/^www\./, "")}`;
  }
}

function resolveCanonicalDomain(record: Record<string, string>): string {
  const canonical = record.canonical_domain?.trim();
  if (canonical) return canonicalDomainFromHost(canonical);

  const domain = record.domain?.trim();
  if (domain) return canonicalDomainFromHost(domain);

  const fromUrl = displayUrlHostOnly(record.normalized_url ?? "");
  if (!fromUrl) return "";
  try {
    return canonicalDomainFromHost(new URL(fromUrl).hostname);
  } catch {
    return "";
  }
}

function sanitizeLogoCandidatesJson(
  raw: string,
  max = 3,
): { selected: string; json: string; count: string } {
  const parsed = parseLogoCandidatesJson(raw).slice(0, max);
  if (parsed.length === 0) {
    return { selected: "", json: "", count: "" };
  }
  const slim = parsed.map((c) => ({
    url: c.url,
    ...(c.source ? { source: c.source } : {}),
    ...(c.logoRole ? { logoRole: c.logoRole } : {}),
  }));
  return {
    selected: slim[0]?.url ?? "",
    json: JSON.stringify(slim),
    count: String(parsed.length),
  };
}

export function sanitizeReviewQueueRecord(
  record: Record<string, string>,
  rowIndex: number,
  options: PublishSanitizeOptions,
): BrandAuditRow {
  const row = emptyBrandAuditRow();
  const siteLabel = `Site ${rowIndex + 1}`;
  const canonical = resolveCanonicalDomain(record);
  const displayUrl = canonical ? `https://${canonical}` : "";

  if (options.includeDomains) {
    row.domain = canonical;
    row.canonical_domain = canonical;
    row.normalized_url = displayUrl;
  } else {
    row.domain = siteLabel;
    row.canonical_domain = "";
    row.normalized_url = "";
  }

  row.status = record.status?.trim() ?? "";
  row.error_message = sanitizePublishedErrorMessage(record.error_message ?? "");
  row.elapsed_ms = record.elapsed_ms?.trim() ?? "";
  row.pages_inspected = record.pages_inspected?.trim() ?? "";
  row.extraction_provider = record.extraction_provider?.trim() ?? "";
  row.extraction_model = record.extraction_model?.trim() ?? "";
  row.extracted_business_name = record.extracted_business_name?.trim() ?? "";
  row.extracted_business_category =
    record.extracted_business_category?.trim() ?? "";
  row.extracted_tagline = record.extracted_tagline?.trim() ?? "";
  row.extracted_summary = record.extracted_summary?.trim() ?? "";
  row.extracted_emails = record.extracted_emails?.trim() ?? "";
  row.extracted_phone_numbers = record.extracted_phone_numbers?.trim() ?? "";
  row.extracted_social_links = record.extracted_social_links?.trim() ?? "";
  row.extracted_addresses = record.extracted_addresses?.trim() ?? "";
  row.extracted_contact_links = record.extracted_contact_links?.trim() ?? "";
  row.extracted_products = record.extracted_products?.trim() ?? "";
  row.extracted_services = record.extracted_services?.trim() ?? "";
  row.extracted_products_services =
    record.extracted_products_services?.trim() ?? "";

  row.business_name_score = record.business_name_score?.trim() ?? "";
  row.category_score = record.category_score?.trim() ?? "";
  row.logo_score = record.logo_score?.trim() ?? "";
  row.brief_score = record.brief_score?.trim() ?? "";
  row.overall_score = record.overall_score?.trim() ?? "";
  row.reviewer_notes = record.reviewer_notes?.trim() ?? "";

  row.extracted_color_hexes = record.extracted_color_hexes?.trim() ?? "";
  row.primary_color_hex = record.primary_color_hex?.trim() ?? "";
  row.secondary_color_hex = record.secondary_color_hex?.trim() ?? "";

  if (options.includeLogoUrls) {
    const logos = sanitizeLogoCandidatesJson(record.logo_candidate_urls ?? "");
    if (logos.json) {
      row.logo_candidate_urls = logos.json;
      row.selected_logo_url = logos.selected;
      row.logo_candidate_count =
        record.logo_candidate_count?.trim() || logos.count;
    } else {
      const selected = record.selected_logo_url?.trim() ?? "";
      if (selected) {
        row.selected_logo_url = selected;
        row.logo_candidate_urls = JSON.stringify([{ url: selected }]);
        row.logo_candidate_count = "1";
      }
    }
  } else {
    const count = record.logo_candidate_count?.trim();
    row.logo_candidate_count = count || "";
  }

  return row;
}

export function sanitizeReviewQueueRecords(
  records: Record<string, string>[],
  options: PublishSanitizeOptions,
): { rows: BrandAuditRow[]; stats: PublishSanitizeStats } {
  const rows = records.map((record, index) =>
    sanitizeReviewQueueRecord(record, index, options),
  );

  let rowsWithLogos = 0;
  let rowsWithPalettes = 0;
  for (const row of rows) {
    if (logoCandidatesForRow(row).length > 0) rowsWithLogos += 1;
    if (colorEntriesForRow(row).length > 0) rowsWithPalettes += 1;
  }

  return {
    rows,
    stats: {
      rowsRead: records.length,
      rowsPublished: rows.length,
      rowsWithLogos,
      rowsWithPalettes,
    },
  };
}

export function buildPublishedInternalEvalFile(
  sourceReviewQueueBasename: string,
  records: Record<string, string>[],
  options: PublishSanitizeOptions,
): { file: PublishedInternalEvalFile; stats: PublishSanitizeStats } {
  const { rows, stats } = sanitizeReviewQueueRecords(records, options);
  return {
    file: {
      description:
        "Sanitized published review data for /internal/eval. No partner IDs, requirement text, or raw URLs with paths.",
      published_at: new Date().toISOString(),
      source_review_queue: sourceReviewQueueBasename,
      include_domains: options.includeDomains,
      include_logo_urls: options.includeLogoUrls,
      rows,
    },
    stats,
  };
}
