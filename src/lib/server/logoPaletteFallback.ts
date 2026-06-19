import type { DesignIntakeExtractResponse } from "@/lib/designIntakeApiSchema";
import { derivePaletteFromLogoCandidates } from "@/lib/server/logoPaletteExtraction";

/**
 * When explicit brand colors are missing, derive a palette from logo candidate images.
 * Mutates the response in place; does not overwrite existing colors.
 */
export async function applyLogoPaletteFallback(
  response: DesignIntakeExtractResponse,
): Promise<void> {
  if (!response.ok) return;
  if (response.brand.colors.length > 0) {
    if (!response.brand.paletteSource) {
      response.brand.paletteSource = "extraction";
      response.brand.paletteConfidence = "high";
    }
    return;
  }

  const logos = response.brand.logoCandidates ?? [];
  if (logos.length === 0) return;

  const derived = await derivePaletteFromLogoCandidates(logos);
  if (!derived || derived.colors.length === 0) return;

  response.brand.colors = derived.colors;
  response.brand.paletteSource = derived.paletteSource;
  response.brand.paletteConfidence = derived.paletteConfidence;
  response.brand.paletteRawColorCount = derived.rawColorCount;
  response.brand.paletteDistinctColorCount = derived.distinctColorCount;
  response.metadata.paletteRawColorCount = derived.rawColorCount;
  response.metadata.paletteDistinctColorCount = derived.distinctColorCount;
  response.metadata.warnings.push(
    "Brand colors derived from logo image (palette fallback).",
  );
}
