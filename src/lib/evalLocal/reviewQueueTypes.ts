/** Text columns used in audit table helpers (contact columns are separate visual cells). */
export const REVIEW_QUEUE_AUDIT_COLUMNS = [
  "domain",
  "extracted_business_name",
  "status",
] as const;

export type ReviewQueueAuditColumn = (typeof REVIEW_QUEUE_AUDIT_COLUMNS)[number];

/** @deprecated Use REVIEW_QUEUE_AUDIT_COLUMNS */
export const REVIEW_QUEUE_VISIBLE_COLUMNS = [
  "normalized_url",
  "extracted_business_name",
] as const;

export type ReviewQueueVisibleColumn =
  (typeof REVIEW_QUEUE_VISIBLE_COLUMNS)[number];

export const REVIEW_QUEUE_ALL_COLUMNS = [
  "ds_number",
  "ds_id",
  "project_title",
  "project_type",
  "shop_code",
  "normalized_url",
  "domain",
  "canonical_domain",
  "source_column",
  "first_req_description_excerpt",
  "first_req_note_excerpt",
  "status",
  "elapsed_ms",
  "error_message",
  "extracted_business_name",
  "extracted_business_category",
  "extracted_tagline",
  "extracted_summary",
  "extracted_emails",
  "extracted_phone_numbers",
  "extracted_social_links",
  "extracted_addresses",
  "extracted_contact_links",
  "extracted_products",
  "extracted_services",
  "extracted_products_services",
  "logo_candidate_count",
  "selected_logo_url",
  "logo_candidate_urls",
  "extracted_color_hexes",
  "primary_color_hex",
  "secondary_color_hex",
  "pages_inspected",
  "extraction_provider",
  "extraction_model",
  "business_name_score",
  "category_score",
  "logo_score",
  "brief_score",
  "overall_score",
  "reviewer_notes",
  "business_name_similarity_hint",
  "title_business_name_overlap_hint",
  "extraction_run_id",
  "processed_at",
  "source_review_queue",
  "duplicate_source_urls",
] as const;

export type ReviewQueueRow = Record<(typeof REVIEW_QUEUE_ALL_COLUMNS)[number], string>;

/** Alias used by gallery/table viewers — same shape as review queue CSV rows. */
export type { BrandAuditRow } from "./brandAuditRow";
