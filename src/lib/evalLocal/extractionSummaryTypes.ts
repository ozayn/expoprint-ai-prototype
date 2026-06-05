/** All columns read from extraction_summary CSV files. */
export const EXTRACTION_SUMMARY_TABLE_COLUMNS = [
  "ds_number",
  "project_title",
  "project_type",
  "shop_code",
  "normalized_url",
  "domain",
  "canonical_domain",
  "status",
  "elapsed_ms",
  "error_message",
  "extracted_business_name",
  "logo_candidate_count",
] as const;

/** Primary columns shown in /dev/eval extraction table (secondary section). */
export const EXTRACTION_SUMMARY_VISIBLE_COLUMNS = [
  "ds_number",
  "project_title",
  "normalized_url",
  "status",
  "elapsed_ms",
] as const;

export type ExtractionSummaryRow = Record<
  (typeof EXTRACTION_SUMMARY_TABLE_COLUMNS)[number],
  string
> & {
  pages_inspected?: string;
};
