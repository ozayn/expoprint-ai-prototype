import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";
import { normalizeBrandAuditRow } from "@/lib/evalLocal/brandAuditRow";
import type {
  PublishedInternalEvalUrlInventoryFile,
  PublishedUrlInventoryRow,
} from "@/lib/evalLocal/publishedInternalEvalTypes";
import {
  URL_CANDIDATE_COLUMNS,
  type UrlCandidateRow,
} from "@/lib/evalLocal/urlCandidateTypes";
import type { UrlInventoryRow } from "@/lib/evalLocal/urlInventoryJoin";

export function publishedUrlInventoryRowToUrlInventoryRow(
  row: PublishedUrlInventoryRow,
): UrlInventoryRow {
  const candidate = Object.fromEntries(
    URL_CANDIDATE_COLUMNS.map((col) => [col, ""]),
  ) as UrlCandidateRow;

  candidate.domain = row.domain?.trim() || row.row_label?.trim() || "";
  candidate.canonical_domain = row.canonical_domain?.trim() || "";
  candidate.normalized_url = row.normalized_url?.trim() || "";
  candidate.project_title = row.project_title?.trim() || "";
  candidate.project_type = row.project_type?.trim() || "";
  candidate.source_column = row.source_column?.trim() || "";

  let review: BrandAuditRow | null = null;
  if (row.review) {
    review = normalizeBrandAuditRow(row.review) ?? null;
  }

  return {
    candidate,
    extractionStatus: row.extraction_status,
    review,
  };
}

export function publishedUrlInventoryRowsToUrlInventoryRows(
  rows: PublishedUrlInventoryRow[],
): UrlInventoryRow[] {
  return rows.map(publishedUrlInventoryRowToUrlInventoryRow);
}

export function parsePublishedUrlInventoryFile(
  raw: string,
  filename: string,
): PublishedInternalEvalUrlInventoryFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid URL inventory JSON fixture: ${filename}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`URL inventory JSON must be an object: ${filename}`);
  }

  const file = parsed as Partial<PublishedInternalEvalUrlInventoryFile>;
  if (!Array.isArray(file.rows)) {
    throw new Error(`URL inventory JSON must include a rows array: ${filename}`);
  }

  return {
    description:
      file.description ??
      "Sanitized published URL inventory for /internal/eval.",
    published_at: file.published_at ?? "",
    source_url_candidates: file.source_url_candidates ?? "",
    source_review_queue: file.source_review_queue ?? "",
    include_domains: file.include_domains ?? false,
    include_project_context: file.include_project_context ?? false,
    include_logo_urls: file.include_logo_urls ?? true,
    rows: file.rows,
  };
}
