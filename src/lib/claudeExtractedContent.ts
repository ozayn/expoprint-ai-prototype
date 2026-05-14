import {
  buildExtractedFromPlainValues,
  type ExtractedKey,
  type ExtractedRow,
} from "@/lib/designIntakeState";

/** Keys we expect on `/api/analyze-website` success `extracted` object. */
const REQUIRED_KEYS: ExtractedKey[] = [
  "logo",
  "brandColors",
  "phone",
  "email",
  "address",
  "social",
  "services",
  "products",
];

function isBoolean(v: unknown): v is boolean {
  return typeof v === "boolean";
}

/**
 * Validates `/api/analyze-website` success payload: full `ExtractedRow` map.
 */
export function isValidExtractedRowsPayload(
  data: unknown,
): data is Record<ExtractedKey, ExtractedRow> {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }
  const o = data as Record<string, unknown>;
  for (const key of REQUIRED_KEYS) {
    const row = o[key];
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      return false;
    }
    const r = row as Record<string, unknown>;
    if (typeof r.value !== "string") return false;
    if (!isBoolean(r.useForDesign)) return false;
  }
  return true;
}

/**
 * Parses a plain string map (e.g. raw Claude JSON) into `ExtractedRow` records.
 * Returns null if the payload is not a plain object.
 */
export function normalizeClaudeExtractedPayload(
  data: unknown,
): Record<ExtractedKey, ExtractedRow> | null {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  return buildExtractedFromPlainValues(data as Record<string, unknown>);
}
