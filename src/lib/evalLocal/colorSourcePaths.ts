import { normalizeHex } from "./brandExtractionParse";

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
  if (!expo || typeof expo !== "object") return "no_colors";
  const brand = (expo as Record<string, unknown>).brand as
    | Record<string, unknown>
    | undefined;
  const paletteSource =
    typeof brand?.paletteSource === "string" ? brand.paletteSource.trim() : "";
  const colors = brand?.colors;
  const hasBrandColors =
    Array.isArray(colors) &&
    colors.some((c) => typeof c === "string" && normalizeHex(c));

  if (paletteSource === "logo" && hasBrandColors) return "logo_fallback";
  if (hasBrandColors) return "explicit_extraction";
  return "no_colors";
}
