import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { normalizeBrandAuditRow } from "../../../src/lib/evalLocal/brandAuditRow.js";
import { paletteSourceCellDisplay } from "../../../src/lib/evalLocal/paletteSourceDisplay.js";
import {
  computePaletteSourceDiagnostics,
  reviewRowHasExtractedColors,
} from "../../../src/lib/evalLocal/paletteSourceParse.js";
import { csvRowsToObjects, parseCsv } from "./parseCsv.js";
import {
  REVIEW_QUEUE_COLUMNS,
  type ReviewQueueRow,
} from "./historicalReviewQueue.js";

export type PaletteSourceInspection = {
  filePath: string;
  totalRows: number;
  rowsWithColors: number;
  rowsWithPaletteSource: number;
  bySource: Record<string, number>;
  colorsMissingPaletteSource: number;
  paletteSourceLogo: number;
  paletteSourceExtraction: number;
  samples: Array<{
    domain: string;
    colors: string;
    palette_source: string;
    palette_confidence: string;
    display: string;
  }>;
};

function readReviewQueueRows(filePath: string): ReviewQueueRow[] {
  const text = readFileSync(filePath, "utf8");
  const { headers, records } = csvRowsToObjects(parseCsv(text));
  const hasPaletteSource = headers.includes("palette_source");
  const hasPaletteConfidence = headers.includes("palette_confidence");
  if (!hasPaletteSource || !hasPaletteConfidence) {
    console.warn(
      `Warning: ${basename(filePath)} missing palette_source/palette_confidence columns (found: ${headers.join(", ")})`,
    );
  }

  return records.map((record) => {
    const row = {} as ReviewQueueRow;
    for (const col of REVIEW_QUEUE_COLUMNS) {
      row[col] = record[col] ?? "";
    }
    return row;
  });
}

export function inspectPaletteSourceInReviewCsv(
  filePath: string,
  sampleLimit = 5,
): PaletteSourceInspection {
  const rows = readReviewQueueRows(filePath);
  const diagnostics = computePaletteSourceDiagnostics(rows);

  const bySource: Record<string, number> = {};
  let rowsWithColors = 0;
  let rowsWithPaletteSource = 0;

  for (const row of rows) {
    const hasColors = reviewRowHasExtractedColors(row);
    if (hasColors) rowsWithColors += 1;
    const source = row.palette_source?.trim();
    if (source) {
      rowsWithPaletteSource += 1;
      bySource[source] = (bySource[source] ?? 0) + 1;
    }
  }

  const samples = rows
    .filter((row) => reviewRowHasExtractedColors(row))
    .slice(0, sampleLimit)
    .map((row) => ({
      domain: row.domain?.trim() || row.canonical_domain?.trim() || "—",
      colors:
        row.extracted_color_hexes?.trim() ||
        row.primary_color_hex?.trim() ||
        "—",
      palette_source: row.palette_source?.trim() ?? "",
      palette_confidence: row.palette_confidence?.trim() ?? "",
      display: paletteSourceCellDisplay(row),
    }));

  return {
    filePath,
    totalRows: rows.length,
    rowsWithColors,
    rowsWithPaletteSource,
    bySource,
    colorsMissingPaletteSource: diagnostics.colorsMissingPaletteSource,
    paletteSourceLogo: diagnostics.paletteSourceLogo,
    paletteSourceExtraction: diagnostics.paletteSourceExtraction,
    samples,
  };
}

export function inspectPaletteSourceInPublishedJson(
  filePath: string,
  sampleLimit = 5,
): PaletteSourceInspection {
  const raw = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as { rows?: unknown[] };
  const rows = (parsed.rows ?? [])
    .map(normalizeBrandAuditRow)
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const diagnostics = computePaletteSourceDiagnostics(rows);
  const bySource: Record<string, number> = {};
  let rowsWithColors = 0;
  let rowsWithPaletteSource = 0;

  for (const row of rows) {
    const hasColors = reviewRowHasExtractedColors(row);
    if (hasColors) rowsWithColors += 1;
    const source = row.palette_source?.trim();
    if (source) {
      rowsWithPaletteSource += 1;
      bySource[source] = (bySource[source] ?? 0) + 1;
    }
  }

  const samples = rows
    .filter((row) => reviewRowHasExtractedColors(row))
    .slice(0, sampleLimit)
    .map((row) => ({
      domain: row.domain?.trim() || row.canonical_domain?.trim() || "—",
      colors:
        row.extracted_color_hexes?.trim() ||
        row.primary_color_hex?.trim() ||
        "—",
      palette_source: row.palette_source?.trim() ?? "",
      palette_confidence: row.palette_confidence?.trim() ?? "",
      display: paletteSourceCellDisplay(row),
    }));

  return {
    filePath,
    totalRows: rows.length,
    rowsWithColors,
    rowsWithPaletteSource,
    bySource,
    colorsMissingPaletteSource: diagnostics.colorsMissingPaletteSource,
    paletteSourceLogo: diagnostics.paletteSourceLogo,
    paletteSourceExtraction: diagnostics.paletteSourceExtraction,
    samples,
  };
}

export function printPaletteSourceInspection(
  inspection: PaletteSourceInspection,
): void {
  console.log(`Palette source inspection: ${inspection.filePath}`);
  console.log(`  Total rows:                    ${inspection.totalRows}`);
  console.log(
    `  Rows with extracted_color_hexes: ${inspection.rowsWithColors}`,
  );
  console.log(
    `  Rows with palette_source set:    ${inspection.rowsWithPaletteSource}`,
  );
  console.log(
    `  Colors but missing palette_source:${inspection.colorsMissingPaletteSource}`,
  );
  console.log(`  palette_source=logo:           ${inspection.paletteSourceLogo}`);
  console.log(
    `  palette_source=extraction:       ${inspection.paletteSourceExtraction}`,
  );
  if (Object.keys(inspection.bySource).length > 0) {
    console.log("  By palette_source:");
    for (const [source, count] of Object.entries(inspection.bySource).sort()) {
      console.log(`    ${source}: ${count}`);
    }
  }
  if (inspection.samples.length > 0) {
    console.log("  Sample rows with colors:");
    for (const sample of inspection.samples) {
      console.log(
        `    ${sample.domain} · colors=${sample.colors.slice(0, 40)} · ${sample.display}`,
      );
    }
  }
}
