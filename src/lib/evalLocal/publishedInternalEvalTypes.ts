import type { BrandAuditRow } from "./brandAuditRow";

export type PublishedInternalEvalFile = {
  description: string;
  published_at: string;
  source_review_queue: string;
  include_domains: boolean;
  include_logo_urls: boolean;
  rows: BrandAuditRow[];
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
