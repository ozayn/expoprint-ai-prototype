import { collectColorTokensFromExpo, normalizeHex } from "./brandExtractionParse";
import { extractPaletteMetaFromExpo } from "./paletteSourceParse";

function hasColorValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return Boolean(normalizeHex(value) || value.trim());
  if (Array.isArray(value)) {
    return value.some((item) => hasColorValue(item));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
      const keyLower = key.toLowerCase();
      if (keyLower === "url" || keyLower.includes("logo")) return false;
      return hasColorValue(child);
    });
  }
  return false;
}

export type ColorSourcePathCheck = {
  path: string;
  present: boolean;
};

/** Inspect expo_output for known color-bearing paths (diagnostics only). */
export function detectColorSourcePaths(expo: unknown): ColorSourcePathCheck[] {
  if (!expo || typeof expo !== "object") return [];

  const root = expo as Record<string, unknown>;
  const brand = root.brand as Record<string, unknown> | undefined;
  const designSpec = root.designSpec as Record<string, unknown> | undefined;
  const visualIdentity = root.visualIdentity as Record<string, unknown> | undefined;
  const metadata = root.metadata as Record<string, unknown> | undefined;

  const checks: Array<{ path: string; value: unknown }> = [
    { path: "brand.colors", value: brand?.colors },
    { path: "brand.brandColors", value: brand?.brandColors },
    { path: "palette", value: root.palette },
    { path: "colors", value: root.colors },
    { path: "designSpec.brandColors", value: designSpec?.brandColors },
    { path: "visualIdentity.colors", value: visualIdentity?.colors },
    { path: "metadata.colors", value: metadata?.colors },
  ];

  return checks.map(({ path, value }) => ({
    path,
    present: hasColorValue(value),
  }));
}

export function presentColorSourcePathLabels(
  checks: ColorSourcePathCheck[],
): string[] {
  return checks.filter((c) => c.present).map((c) => c.path);
}

export type PaletteCoverageCategory =
  | "explicit_extraction"
  | "logo_fallback"
  | "no_colors";

export function paletteCoverageCategoryFromExpo(
  expo: unknown,
): PaletteCoverageCategory {
  const tokens = collectColorTokensFromExpo(expo);
  const hasColors = tokens.some((token) => normalizeHex(token));
  if (!hasColors) return "no_colors";

  const meta = extractPaletteMetaFromExpo(expo);
  if (meta.source === "logo" || meta.logoFallbackEvidence) {
    return "logo_fallback";
  }
  return "explicit_extraction";
}
