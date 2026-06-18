import type { ReviewQueueRow } from "./reviewQueueTypes";

export type ExtractedPaletteMeta = {
  source?: string;
  confidence?: string;
  logoFallbackEvidence?: boolean;
};

const SOURCE_KEYS = ["paletteSource", "palette_source", "colorsSource", "colorSource"];
const CONFIDENCE_KEYS = ["paletteConfidence", "palette_confidence"];

function readStringField(
  obj: Record<string, unknown> | undefined,
  keys: string[],
): string {
  if (!obj) return "";
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function normalizePaletteSource(raw: string): string {
  const normalized = raw.trim().toLowerCase();
  if (
    normalized === "logo" ||
    normalized === "logo_fallback" ||
    normalized === "logo-fallback"
  ) {
    return "logo";
  }
  if (
    normalized === "extraction" ||
    normalized === "explicit" ||
    normalized === "extracted" ||
    normalized === "explicit_extraction"
  ) {
    return "extraction";
  }
  return raw.trim();
}

export function normalizePaletteConfidence(raw: string): string {
  const normalized = raw.trim().toLowerCase();
  if (
    normalized === "high" ||
    normalized === "medium" ||
    normalized === "low" ||
    normalized === "unknown"
  ) {
    return normalized;
  }
  return raw.trim();
}

/** Metadata warning text from logo palette fallback. */
export function hasLogoPaletteFallbackWarning(expo: unknown): boolean {
  if (!expo || typeof expo !== "object") return false;
  const meta = (expo as Record<string, unknown>).metadata as
    | Record<string, unknown>
    | undefined;
  const warnings = meta?.warnings;
  if (!Array.isArray(warnings)) return false;
  return warnings.some(
    (warning) =>
      typeof warning === "string" &&
      /derived from logo|logo image \(palette fallback\)/i.test(warning),
  );
}

/** Read palette source/confidence from expo_output across camelCase and snake_case paths. */
export function extractPaletteMetaFromExpo(expo: unknown): ExtractedPaletteMeta {
  if (!expo || typeof expo !== "object") return {};

  const root = expo as Record<string, unknown>;
  const brand = root.brand as Record<string, unknown> | undefined;
  const visualIdentity = root.visualIdentity as Record<string, unknown> | undefined;
  const designSpec = root.designSpec as Record<string, unknown> | undefined;
  const metadata = root.metadata as Record<string, unknown> | undefined;

  const rawSource =
    readStringField(brand, SOURCE_KEYS) ||
    readStringField(root, SOURCE_KEYS) ||
    readStringField(visualIdentity, SOURCE_KEYS) ||
    readStringField(designSpec, SOURCE_KEYS) ||
    readStringField(metadata, SOURCE_KEYS);

  const rawConfidence =
    readStringField(brand, CONFIDENCE_KEYS) ||
    readStringField(root, CONFIDENCE_KEYS) ||
    readStringField(visualIdentity, CONFIDENCE_KEYS) ||
    readStringField(designSpec, CONFIDENCE_KEYS) ||
    readStringField(metadata, CONFIDENCE_KEYS);

  const source = rawSource ? normalizePaletteSource(rawSource) : undefined;
  const confidence = rawConfidence
    ? normalizePaletteConfidence(rawConfidence)
    : undefined;
  const logoFallbackEvidence =
    hasLogoPaletteFallbackWarning(expo) || source === "logo";

  return {
    source,
    confidence,
    logoFallbackEvidence,
  };
}

export function reviewRowHasExtractedColors(
  colorFields: Pick<
    ReviewQueueRow,
    "extracted_color_hexes" | "primary_color_hex" | "secondary_color_hex"
  >,
): boolean {
  return Boolean(
    colorFields.extracted_color_hexes?.trim() ||
      colorFields.primary_color_hex?.trim() ||
      colorFields.secondary_color_hex?.trim(),
  );
}

export function resolveReviewPaletteFields(
  expo: unknown,
  colorFields: Pick<
    ReviewQueueRow,
    "extracted_color_hexes" | "primary_color_hex" | "secondary_color_hex"
  >,
): Pick<ReviewQueueRow, "palette_source" | "palette_confidence"> {
  const meta = extractPaletteMetaFromExpo(expo);
  let source = meta.source ?? "";
  let confidence = meta.confidence ?? "";

  const hasColors = reviewRowHasExtractedColors(colorFields);

  if (!source && hasColors) {
    if (meta.logoFallbackEvidence) {
      source = "logo";
      confidence = confidence || "medium";
    } else {
      source = "extraction";
      confidence = confidence || "unknown";
    }
  }

  return {
    palette_source: source,
    palette_confidence: confidence,
  };
}

export type PaletteSourceDiagnostics = {
  colorsMissingPaletteSource: number;
  paletteSourceLogo: number;
  paletteSourceExtraction: number;
};

export function computePaletteSourceDiagnostics(
  rows: ReviewQueueRow[],
): PaletteSourceDiagnostics {
  let colorsMissingPaletteSource = 0;
  let paletteSourceLogo = 0;
  let paletteSourceExtraction = 0;

  for (const row of rows) {
    if (row.status?.trim() !== "success") continue;

    const hasColors = reviewRowHasExtractedColors(row);
    const source = row.palette_source?.trim() ?? "";

    if (hasColors && !source) colorsMissingPaletteSource += 1;
    if (source === "logo") paletteSourceLogo += 1;
    if (source === "extraction") paletteSourceExtraction += 1;
  }

  return {
    colorsMissingPaletteSource,
    paletteSourceLogo,
    paletteSourceExtraction,
  };
}
