import type { UrlInventoryExtractionStatus } from "./urlInventoryJoin";

export type EvalNormalizedStatus = "success" | "failed" | "not_run";

export type EvalStatusSource = {
  status?: string | null;
  extraction_status?: string | null;
  extractionStatus?: UrlInventoryExtractionStatus | null;
};

/**
 * Normalize a raw status string (review row status, extraction_status, etc.).
 * Does not rely on display labels like "Success" / "Failed".
 */
export function normalizeStatusValue(
  raw: string | null | undefined,
): EvalNormalizedStatus {
  const normalized = raw?.trim().toLowerCase().replace(/\s+/g, "_");
  if (!normalized) return "not_run";

  if (
    normalized === "success" ||
    normalized === "ok" ||
    normalized === "completed"
  ) {
    return "success";
  }

  if (
    normalized === "fetch_error" ||
    normalized === "extraction_error" ||
    normalized === "error" ||
    normalized === "failed" ||
    normalized === "timeout" ||
    normalized === "skipped"
  ) {
    return "failed";
  }

  if (
    normalized === "not_run" ||
    normalized === "pending" ||
    normalized === "missing" ||
    normalized === "no_data_yet" ||
    normalized === "no_data" ||
    normalized === "blank"
  ) {
    return "not_run";
  }

  // Unknown non-empty status: treated as failed (processed but not success).
  return "failed";
}

/**
 * Normalize eval row status for filtering and display.
 * Prefers inventory extractionStatus when explicitly not_run; otherwise uses review status.
 */
export function normalizeEvalStatus(source: EvalStatusSource): EvalNormalizedStatus {
  if (source.extractionStatus === "not_run") {
    const reviewStatus = source.status?.trim();
    if (!reviewStatus) return "not_run";
    return normalizeStatusValue(source.status);
  }

  if (source.extraction_status?.trim()) {
    return normalizeStatusValue(source.extraction_status);
  }

  if (source.extractionStatus === "success") return "success";
  if (source.extractionStatus === "failed") return "failed";

  return normalizeStatusValue(source.status);
}
