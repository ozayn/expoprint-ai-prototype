import type { BrandAuditRow } from "./brandAuditRow";
import type { UrlInventoryExtractionStatus } from "./urlInventoryJoin";

export type PublishedInternalEvalFile = {
  description: string;
  published_at: string;
  source_review_queue: string;
  include_domains: boolean;
  include_logo_urls: boolean;
  rows: BrandAuditRow[];
};

/** Sanitized URL inventory row for deployed /internal/eval (no partner IDs or requirement text). */
export type PublishedUrlInventoryRow = {
  row_label: string;
  canonical_domain?: string;
  domain?: string;
  normalized_url?: string;
  project_title?: string;
  project_type?: string;
  source_column?: string;
  source_review_queue?: string;
  extraction_run_id?: string;
  processed_at?: string;
  duplicate_source_urls?: string;
  extraction_status: UrlInventoryExtractionStatus;
  review: BrandAuditRow | null;
};

export type PublishedInternalEvalUrlInventoryFile = {
  description: string;
  published_at: string;
  source_url_candidates: string;
  source_review_queue: string;
  include_domains: boolean;
  include_project_context: boolean;
  include_logo_urls: boolean;
  rows: PublishedUrlInventoryRow[];
};

export type InternalEvalDataSource = "published" | "sample";

export type InternalEvalReviewPayload = {
  filename: string;
  rows: BrandAuditRow[];
  source: InternalEvalDataSource;
  sourceLabel: string;
  publishedAt?: string;
  sourceReviewQueue?: string;
};

export type InternalEvalUrlInventoryPayload = {
  filename: string;
  rows: PublishedUrlInventoryRow[];
  publishedAt: string;
  sourceUrlCandidates: string;
  sourceReviewQueue: string;
  includeDomains: boolean;
  includeProjectContext: boolean;
  includeLogoUrls: boolean;
};

export type InternalEvalDatasetPayload = {
  review: InternalEvalReviewPayload;
  urlInventory: InternalEvalUrlInventoryPayload | null;
};
