import type { BrandAuditRow } from "./brandAuditRow";
import { colorEntriesForRow } from "./brandExtractionParse";
import { reviewRowHasExtractedColors } from "./paletteSourceParse";

export function rowHasExtractedColors(row: BrandAuditRow): boolean {
  if (reviewRowHasExtractedColors(row)) return true;
  return colorEntriesForRow(row).length > 0;
}

/** User-facing palette source line for gallery/table expanded details. */
export function formatPaletteSourceDisplay(row: BrandAuditRow): string | null {
  const hasColors = rowHasExtractedColors(row);
  if (!hasColors) return null;

  const source = row.palette_source?.trim();
  const confidence = row.palette_confidence?.trim();
  const rawCount = row.palette_raw_color_count?.trim();
  const distinctCount = row.palette_distinct_color_count?.trim();
  const statsSuffix =
    rawCount && distinctCount
      ? ` · ${rawCount} raw → ${distinctCount} distinct`
      : "";

  if (source && confidence) {
    return `Palette source: ${source} / ${confidence}${statsSuffix}`;
  }
  if (source) {
    return `Palette source: ${source}${statsSuffix}`;
  }
  return `Palette source unknown${statsSuffix}`;
}

export function paletteSourceColumnDisplay(row: BrandAuditRow): string {
  const source = row.palette_source?.trim();
  if (source) return source;
  if (rowHasExtractedColors(row)) return "unknown";
  return "";
}

export function paletteConfidenceColumnDisplay(row: BrandAuditRow): string {
  const confidence = row.palette_confidence?.trim();
  if (confidence) return confidence;
  if (rowHasExtractedColors(row)) return "unknown";
  return "";
}

/** Compact source/confidence label for diagnostics and inspect CLI. */
export function paletteSourceCellDisplay(row: BrandAuditRow): string {
  const source = paletteSourceColumnDisplay(row);
  const confidence = paletteConfidenceColumnDisplay(row);
  if (source && confidence) return `${source} / ${confidence}`;
  return source;
}
