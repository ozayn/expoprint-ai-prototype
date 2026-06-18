import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import {
  collectColorTokensFromExpo,
  brandColorFieldsFromTokens,
} from "../../../src/lib/evalLocal/brandExtractionParse.js";
import {
  detectColorSourcePaths,
  paletteCoverageCategoryFromExpo,
  presentColorSourcePathLabels,
  type PaletteCoverageCategory,
} from "../../../src/lib/evalLocal/colorSourcePaths.js";
import type { ExtractionJsonlRecord } from "../../../src/lib/evalLocal/extractionTypes.js";
import { firstPositionalArg, hasFlag, printHelp } from "./cliArgs.js";
import {
  isSafeExtractionRunPath,
  parseExtractionJsonl,
} from "./historicalReviewQueue.js";
import {
  EVAL_RESULTS_DIR,
  ensureEvalDirs,
  runTimestampId,
} from "./paths.js";
import { escapeCsvCell } from "./urlCandidates.js";

export type ColorAuditRow = {
  domain: string;
  status: string;
  has_logo_candidates: boolean;
  logo_candidate_count: number;
  has_colors: boolean;
  extracted_colors: string;
  color_source_paths: string;
  logos_without_colors: boolean;
  palette_coverage: PaletteCoverageCategory;
};

export type ColorAuditSummary = {
  inputPath: string;
  outputPath: string;
  totalRows: number;
  successRows: number;
  rowsWithLogos: number;
  rowsWithColors: number;
  logosWithoutColors: number;
  explicitExtractionColors: number;
  logoFallbackColors: number;
  noColors: number;
  colorSourcePathCounts: Record<string, number>;
};

const AUDIT_CSV_COLUMNS = [
  "domain",
  "status",
  "has_logo_candidates",
  "logo_candidate_count",
  "has_colors",
  "extracted_colors",
  "color_source_paths",
  "logos_without_colors",
  "palette_coverage",
] as const;

function hasLogoCandidates(record: ExtractionJsonlRecord): boolean {
  const expo = record.expo_output;
  if (!expo?.ok) return false;
  return (expo.brand?.logoCandidates?.length ?? 0) > 0;
}

function logoCandidateCount(record: ExtractionJsonlRecord): number {
  const expo = record.expo_output;
  if (!expo?.ok) return 0;
  return expo.brand?.logoCandidates?.length ?? 0;
}

function extractedColorHexes(record: ExtractionJsonlRecord): string {
  const expo = record.expo_output;
  if (!expo) return "";
  const tokens = collectColorTokensFromExpo(expo);
  const fields = brandColorFieldsFromTokens(tokens);
  return fields.extracted_color_hexes;
}

function auditRowFromRecord(record: ExtractionJsonlRecord): ColorAuditRow {
  const domain =
    record.input.domain?.trim() ||
    record.input.canonical_domain?.trim() ||
    record.input.normalized_url?.trim() ||
    "";
  const logos = hasLogoCandidates(record);
  const logoCount = logoCandidateCount(record);
  const colorHexes = extractedColorHexes(record);
  const hasColors = Boolean(colorHexes.trim());
  const pathChecks = detectColorSourcePaths(record.expo_output);
  const pathLabels = presentColorSourcePathLabels(pathChecks);
  const coverage = paletteCoverageCategoryFromExpo(record.expo_output);

  return {
    domain,
    status: record.status,
    has_logo_candidates: logos,
    logo_candidate_count: logoCount,
    has_colors: hasColors,
    extracted_colors: colorHexes,
    color_source_paths: pathLabels.join("; "),
    logos_without_colors: logos && !hasColors,
    palette_coverage: coverage,
  };
}

export function runColorExtractionAudit(inputPath: string): ColorAuditSummary {
  if (!isSafeExtractionRunPath(inputPath)) {
    throw new Error(
      `Input must be a safe extraction_run_*.jsonl path under data/eval/runs/: ${inputPath}`,
    );
  }

  ensureEvalDirs();
  const text = readFileSync(inputPath, "utf8");
  const { records, parseErrors } = parseExtractionJsonl(text);
  if (parseErrors.length > 0) {
    throw new Error(
      `JSONL parse errors (${parseErrors.length}): first at line ${parseErrors[0]?.line}`,
    );
  }

  const auditRows = records.map(auditRowFromRecord);
  const runId = basename(inputPath).match(/20\d{12}(?:\d{3})?/)?.[0] ?? runTimestampId();
  const outputPath = `${EVAL_RESULTS_DIR}/color_audit_${runId}.csv`;

  const lines = [AUDIT_CSV_COLUMNS.join(",")];
  for (const row of auditRows) {
    lines.push(
      AUDIT_CSV_COLUMNS.map((col) => {
        const value = row[col as keyof ColorAuditRow];
        if (typeof value === "boolean") return escapeCsvCell(value ? "1" : "0");
        return escapeCsvCell(String(value ?? ""));
      }).join(","),
    );
  }
  writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");

  const colorSourcePathCounts: Record<string, number> = {};
  let successRows = 0;
  let rowsWithLogos = 0;
  let rowsWithColors = 0;
  let logosWithoutColors = 0;
  let explicitExtractionColors = 0;
  let logoFallbackColors = 0;
  let noColors = 0;

  for (const row of auditRows) {
    if (row.status === "success") successRows += 1;
    if (row.has_logo_candidates) rowsWithLogos += 1;
    if (row.has_colors) rowsWithColors += 1;
    if (row.logos_without_colors) logosWithoutColors += 1;
    if (row.palette_coverage === "explicit_extraction") explicitExtractionColors += 1;
    else if (row.palette_coverage === "logo_fallback") logoFallbackColors += 1;
    else noColors += 1;

    for (const path of row.color_source_paths.split("; ").filter(Boolean)) {
      colorSourcePathCounts[path] = (colorSourcePathCounts[path] ?? 0) + 1;
    }
  }

  return {
    inputPath,
    outputPath,
    totalRows: auditRows.length,
    successRows,
    rowsWithLogos,
    rowsWithColors,
    logosWithoutColors,
    explicitExtractionColors,
    logoFallbackColors,
    noColors,
    colorSourcePathCounts,
  };
}

export function printColorAuditSummary(summary: ColorAuditSummary): void {
  console.log("Color extraction audit");
  console.log(`  Input:                 ${summary.inputPath}`);
  console.log(`  Output CSV:            ${summary.outputPath}`);
  console.log(`  Total rows:            ${summary.totalRows.toLocaleString()}`);
  console.log(`  Success rows:          ${summary.successRows.toLocaleString()}`);
  console.log(`  Rows with logos:       ${summary.rowsWithLogos.toLocaleString()}`);
  console.log(`  Rows with colors:      ${summary.rowsWithColors.toLocaleString()}`);
  console.log(
    `  Logos but no colors:   ${summary.logosWithoutColors.toLocaleString()}`,
  );
  console.log(
    `  Colors (extraction):   ${summary.explicitExtractionColors.toLocaleString()}`,
  );
  console.log(
    `  Colors (logo fallback):${summary.logoFallbackColors.toLocaleString()}`,
  );
  console.log(`  No colors:             ${summary.noColors.toLocaleString()}`);
  console.log("  Color source path counts:");
  for (const [path, count] of Object.entries(summary.colorSourcePathCounts).sort()) {
    console.log(`    ${path}: ${count.toLocaleString()}`);
  }
}

export function runColorExtractionAuditCli(): void {
  const inputPath = firstPositionalArg();
  if (!inputPath || hasFlag("--help") || hasFlag("-h")) {
    printHelp("Usage: npm run eval:audit-colors -- <extraction_run.jsonl>", [
      "",
      "Inspect expo_output color fields per JSONL row (diagnostics only).",
      "",
      "Example:",
      "  npm run eval:audit-colors -- data/eval/runs/extraction_run_<timestamp>.jsonl",
    ]);
    process.exit(inputPath || hasFlag("--help") || hasFlag("-h") ? 0 : 1);
    return;
  }

  const summary = runColorExtractionAudit(inputPath);
  console.log("");
  printColorAuditSummary(summary);
}
