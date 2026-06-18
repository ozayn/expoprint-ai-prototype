import {
  colorEntriesForRow,
  logoCandidatesForRow,
  parseHexListJson,
} from "./brandExtractionParse";
import type { ReviewQueueRow } from "./reviewQueueTypes";
import { reviewRowHasExtractedColors } from "./paletteSourceParse";

export type BackfillPaletteReason = "logo" | "extraction";

export type BackfillPaletteInference = {
  palette_source: string;
  palette_confidence: string;
  reason: BackfillPaletteReason;
};

export type BackfillPaletteChange = {
  domain: string;
  normalized_url: string;
  palette_source: string;
  palette_confidence: string;
  reason: BackfillPaletteReason;
};

export type BackfillPaletteMetadataSummary = {
  rowsUpdated: number;
  logoInferred: number;
  extractionInferred: number;
  changes: BackfillPaletteChange[];
};

export function rowNeedsPaletteBackfill(row: ReviewQueueRow): boolean {
  if (!reviewRowHasExtractedColors(row)) return false;
  return !row.palette_source?.trim();
}

export function rowHasLogoCandidates(row: ReviewQueueRow): boolean {
  if (row.selected_logo_url?.trim()) return true;
  const count = Number.parseInt(row.logo_candidate_count?.trim() ?? "", 10);
  if (Number.isFinite(count) && count > 0) return true;
  return logoCandidatesForRow(row).length > 0;
}

/** True when palette_source already indicates explicit page extraction (not logo fallback). */
export function rowHasExplicitExtractionSource(row: ReviewQueueRow): boolean {
  const source = row.palette_source?.trim().toLowerCase();
  return (
    source === "extraction" ||
    source === "explicit" ||
    source === "extracted" ||
    source === "explicit_extraction"
  );
}

/**
 * Heuristic for logo palette fallback: multi-color JSON array without primary/secondary slots.
 * Explicit extraction rows usually populate primary_color_hex / secondary_color_hex.
 */
export function colorsLookLikeLogoDerived(row: ReviewQueueRow): boolean {
  const hexes = parseHexListJson(row.extracted_color_hexes);
  if (hexes.length === 0) {
    const entries = colorEntriesForRow(row);
    if (entries.length === 0) return false;
    hexes.push(...entries.map((entry) => entry.hex));
  }

  if (hexes.length < 2 || hexes.length > 6) return false;

  const hasPrimarySecondary =
    row.primary_color_hex?.trim() || row.secondary_color_hex?.trim();
  return !hasPrimarySecondary;
}

export function inferBackfillPaletteMetadata(
  row: ReviewQueueRow,
): BackfillPaletteInference | null {
  if (!rowNeedsPaletteBackfill(row)) return null;

  const hasLogos = rowHasLogoCandidates(row);
  const logoLikeColors = colorsLookLikeLogoDerived(row);
  const noExplicitExtraction = !rowHasExplicitExtractionSource(row);

  if (logoLikeColors || (hasLogos && noExplicitExtraction)) {
    return {
      palette_source: "logo",
      palette_confidence: "medium",
      reason: "logo",
    };
  }

  return {
    palette_source: "extraction",
    palette_confidence: "unknown",
    reason: "extraction",
  };
}

export function applyBackfillPaletteMetadataToRow(
  row: ReviewQueueRow,
): { row: ReviewQueueRow; changed: boolean; inference?: BackfillPaletteInference } {
  const inference = inferBackfillPaletteMetadata(row);
  if (!inference) return { row, changed: false };

  return {
    row: {
      ...row,
      palette_source: inference.palette_source,
      palette_confidence: inference.palette_confidence,
    },
    changed: true,
    inference,
  };
}

export function backfillPaletteMetadataOnRows(
  rows: ReviewQueueRow[],
): { rows: ReviewQueueRow[]; summary: BackfillPaletteMetadataSummary } {
  const changes: BackfillPaletteChange[] = [];
  let logoInferred = 0;
  let extractionInferred = 0;

  const updated = rows.map((row) => {
    const { row: next, changed, inference } = applyBackfillPaletteMetadataToRow(row);
    if (!changed || !inference) return row;

    if (inference.reason === "logo") logoInferred += 1;
    else extractionInferred += 1;

    changes.push({
      domain: row.domain?.trim() || row.canonical_domain?.trim() || "—",
      normalized_url: row.normalized_url?.trim() || "",
      palette_source: inference.palette_source,
      palette_confidence: inference.palette_confidence,
      reason: inference.reason,
    });

    return next;
  });

  return {
    rows: updated,
    summary: {
      rowsUpdated: changes.length,
      logoInferred,
      extractionInferred,
      changes,
    },
  };
}
