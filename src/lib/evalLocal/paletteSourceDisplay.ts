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

  if (source && confidence) {
    return `Palette source: ${source} / ${confidence}`;
  }
  if (source) {
    return `Palette source: ${source}`;
  }
  return "Palette source unknown";
}

export function paletteSourceCellDisplay(row: BrandAuditRow): string {
  const source = row.palette_source?.trim();
  const confidence = row.palette_confidence?.trim();
  if (source && confidence) return `${source} / ${confidence}`;
  if (source) return source;
  if (rowHasExtractedColors(row)) return "unknown";
  return "";
}
