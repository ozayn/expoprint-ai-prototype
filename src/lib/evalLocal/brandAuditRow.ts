import {
  REVIEW_QUEUE_ALL_COLUMNS,
  type ReviewQueueRow,
} from "./reviewQueueTypes";
import {
  normalizePaletteConfidence,
  normalizePaletteSource,
} from "./paletteSourceParse";

const PALETTE_SOURCE_ALIASES = [
  "paletteSource",
  "colorsSource",
  "colorSource",
] as const;

const PALETTE_CONFIDENCE_ALIASES = ["paletteConfidence"] as const;

export function applyPaletteMetadataAliases(
  record: Record<string, unknown>,
  row: ReviewQueueRow,
): void {
  if (!row.palette_source?.trim()) {
    for (const key of PALETTE_SOURCE_ALIASES) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        row.palette_source = normalizePaletteSource(value);
        break;
      }
    }
  }

  if (!row.palette_confidence?.trim()) {
    for (const key of PALETTE_CONFIDENCE_ALIASES) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        row.palette_confidence = normalizePaletteConfidence(value);
        break;
      }
    }
  }
}

/**
 * Shared row shape for local CSV review queues and published JSON on `/internal/eval`.
 * Alias of the review queue CSV columns — both viewers render the same fields.
 */
export type BrandAuditRow = ReviewQueueRow;

/** @deprecated Use BrandAuditRow */
export type ReviewRow = BrandAuditRow;

export const BRAND_AUDIT_ROW_COLUMNS = REVIEW_QUEUE_ALL_COLUMNS;

/** Extracted / audit fields both viewers are expected to surface. */
export const BRAND_AUDIT_EXTRACTED_FIELDS = [
  "domain",
  "canonical_domain",
  "normalized_url",
  "extracted_business_name",
  "extracted_business_category",
  "extracted_tagline",
  "extracted_summary",
  "logo_candidate_urls",
  "selected_logo_url",
  "logo_candidate_count",
  "extracted_color_hexes",
  "primary_color_hex",
  "secondary_color_hex",
  "extracted_emails",
  "extracted_phone_numbers",
  "extracted_social_links",
  "extracted_addresses",
  "extracted_contact_links",
  "extracted_products",
  "extracted_services",
  "extracted_products_services",
  "status",
  "error_message",
  "pages_inspected",
  "elapsed_ms",
  "extraction_provider",
  "extraction_model",
  "business_name_score",
  "category_score",
  "logo_score",
  "brief_score",
  "overall_score",
  "reviewer_notes",
] as const;

export type BrandAuditExtractedField = (typeof BRAND_AUDIT_EXTRACTED_FIELDS)[number];

/** Partner-only fields omitted from published /internal/eval data. */
export const BRAND_AUDIT_PARTNER_ONLY_FIELDS = [
  "ds_id",
  "project_title",
  "project_type",
  "shop_code",
  "source_column",
  "first_req_description_excerpt",
  "first_req_note_excerpt",
  "business_name_similarity_hint",
  "title_business_name_overlap_hint",
] as const;

export function emptyBrandAuditRow(): BrandAuditRow {
  return Object.fromEntries(
    BRAND_AUDIT_ROW_COLUMNS.map((col) => [col, ""]),
  ) as BrandAuditRow;
}

export function normalizeBrandAuditRow(
  value: unknown,
): BrandAuditRow | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const row = emptyBrandAuditRow();
  for (const col of BRAND_AUDIT_ROW_COLUMNS) {
    const cell = record[col];
    if (cell === undefined || cell === null) continue;
    if (typeof cell === "string" || typeof cell === "number") {
      row[col] = String(cell);
    }
  }
  applyPaletteMetadataAliases(record, row);
  return row;
}

export function normalizeBrandAuditRows(values: unknown[]): BrandAuditRow[] {
  return values
    .map(normalizeBrandAuditRow)
    .filter((row): row is BrandAuditRow => row !== null);
}
