import { readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { csvRowsToObjects, parseCsv } from "./parseCsv.js";
import { EVAL_RESULTS_DIR, ensureEvalDirs, runTimestampId } from "./paths.js";
import { escapeCsvCell } from "./urlCandidates.js";

export const SCORE_COLUMNS = [
  "business_name_score",
  "category_score",
  "logo_score",
  "brief_score",
  "overall_score",
] as const;

export type ScoreColumn = (typeof SCORE_COLUMNS)[number];

export const DISTRIBUTION_BUCKETS = [
  "0",
  "1",
  "2",
  "3",
  "N/A",
  "blank",
  "invalid",
] as const;

export type DistributionBucket = (typeof DISTRIBUTION_BUCKETS)[number];

export type ScoreDistribution = Record<DistributionBucket, number>;

export type ScoreColumnSummary = {
  column: ScoreColumn;
  average: number | null;
  distribution: ScoreDistribution;
};

export type ReviewScoreSummary = {
  inputFile: string;
  totalRows: number;
  rowsWithOverallScore: number;
  rowsMissingOverallScore: number;
  statusCounts: Record<string, number>;
  scoreColumns: ScoreColumnSummary[];
  reviewerNotesNonEmptyCount: number;
  topReviewerNotes: { note: string; count: number }[];
  successExtractionCount: number;
  failedExtractionCount: number;
  invalidScoreWarnings: { row: number; column: ScoreColumn; value: string }[];
};

export type SummarizeReviewScoresResult = {
  inputPath: string;
  csvOutputPath: string;
  jsonOutputPath: string;
  summary: ReviewScoreSummary;
};

function emptyDistribution(): ScoreDistribution {
  return { "0": 0, "1": 0, "2": 0, "3": 0, "N/A": 0, blank: 0, invalid: 0 };
}

export function isSafeReviewQueueInputPath(path: string): boolean {
  return /^review_queue_20\d{12}\.csv$/.test(basename(path));
}

export function timestampFromReviewQueuePath(path: string): string | undefined {
  const m = basename(path).match(/^review_queue_(20\d{12})\.csv$/);
  return m?.[1];
}

export function classifyScoreValue(raw: string): DistributionBucket {
  const value = raw.trim();
  if (!value) return "blank";
  if (/^n\/a$/i.test(value)) return "N/A";
  if (value === "0" || value === "1" || value === "2" || value === "3") {
    return value;
  }
  return "invalid";
}

export function isNumericScore(bucket: DistributionBucket): bucket is "0" | "1" | "2" | "3" {
  return bucket === "0" || bucket === "1" || bucket === "2" || bucket === "3";
}

function isSuccessStatus(status: string): boolean {
  return status.trim() === "success";
}

function isFailedExtractionStatus(status: string): boolean {
  const s = status.trim();
  return (
    s === "fetch_error" ||
    s === "extraction_error" ||
    s === "skipped" ||
    (s.length > 0 && s !== "success")
  );
}

function incrementStatusCounts(counts: Record<string, number>, status: string): void {
  const key = status.trim() || "(empty)";
  counts[key] = (counts[key] ?? 0) + 1;
}

function summarizeScoreColumn(
  rows: Record<string, string>[],
  column: ScoreColumn,
  invalidScoreWarnings: ReviewScoreSummary["invalidScoreWarnings"],
): ScoreColumnSummary {
  const distribution = emptyDistribution();
  const numericValues: number[] = [];

  rows.forEach((row, index) => {
    const raw = row[column] ?? "";
    const bucket = classifyScoreValue(raw);
    distribution[bucket] += 1;

    if (bucket === "invalid") {
      invalidScoreWarnings.push({
        row: index + 2,
        column,
        value: raw.trim(),
      });
    }

    if (isNumericScore(bucket)) {
      numericValues.push(Number(bucket));
    }
  });

  const average =
    numericValues.length > 0
      ? numericValues.reduce((sum, n) => sum + n, 0) / numericValues.length
      : null;

  return { column, average, distribution };
}

function topNotes(
  rows: Record<string, string>[],
  limit = 5,
): { note: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const note = (row.reviewer_notes ?? "").trim();
    if (!note) continue;
    counts.set(note, (counts.get(note) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([note, count]) => ({ note, count }));
}

export function summarizeReviewQueueRows(
  inputPath: string,
  rows: Record<string, string>[],
): ReviewScoreSummary {
  const invalidScoreWarnings: ReviewScoreSummary["invalidScoreWarnings"] = [];
  const statusCounts: Record<string, number> = {};

  let rowsWithOverallScore = 0;
  let successExtractionCount = 0;
  let failedExtractionCount = 0;

  for (const row of rows) {
    const overall = (row.overall_score ?? "").trim();
    if (overall) rowsWithOverallScore += 1;

    const status = row.status ?? "";
    incrementStatusCounts(statusCounts, status);

    if (isSuccessStatus(status)) successExtractionCount += 1;
    else if (isFailedExtractionStatus(status)) failedExtractionCount += 1;
  }

  let reviewerNotesNonEmptyCount = 0;
  for (const row of rows) {
    if ((row.reviewer_notes ?? "").trim()) reviewerNotesNonEmptyCount += 1;
  }

  return {
    inputFile: inputPath,
    totalRows: rows.length,
    rowsWithOverallScore,
    rowsMissingOverallScore: rows.length - rowsWithOverallScore,
    statusCounts,
    scoreColumns: SCORE_COLUMNS.map((column) =>
      summarizeScoreColumn(rows, column, invalidScoreWarnings),
    ),
    reviewerNotesNonEmptyCount,
    topReviewerNotes: topNotes(rows),
    successExtractionCount,
    failedExtractionCount,
    invalidScoreWarnings,
  };
}

export function summarizeReviewQueueCsv(
  inputPath: string,
  options: { strict?: boolean } = {},
): ReviewScoreSummary {
  if (!isSafeReviewQueueInputPath(inputPath)) {
    throw new Error(
      `Expected review_queue_<timestamp>.csv, got: ${basename(inputPath)}`,
    );
  }

  const text = readFileSync(inputPath, "utf8");
  const { records } = csvRowsToObjects(parseCsv(text));
  const summary = summarizeReviewQueueRows(inputPath, records);

  if (options.strict && summary.invalidScoreWarnings.length > 0) {
    const first = summary.invalidScoreWarnings[0]!;
    throw new Error(
      `Invalid score at row ${first.row}, column ${first.column}: "${first.value}"`,
    );
  }

  return summary;
}

function formatAverage(value: number | null): string {
  if (value === null) return "";
  return value.toFixed(3).replace(/\.?0+$/, "") || "0";
}

export function scoreSummaryToCsv(summary: ReviewScoreSummary): string {
  const lines: string[] = [["section", "key", "value"].join(",")];

  const add = (section: string, key: string, value: string | number) => {
    lines.push(
      [section, key, escapeCsvCell(String(value))].join(","),
    );
  };

  add("meta", "input_file", summary.inputFile);
  add("meta", "total_rows", summary.totalRows);
  add("meta", "rows_with_overall_score", summary.rowsWithOverallScore);
  add("meta", "rows_missing_overall_score", summary.rowsMissingOverallScore);
  add("meta", "reviewer_notes_non_empty_count", summary.reviewerNotesNonEmptyCount);
  add("meta", "extraction_success_count", summary.successExtractionCount);
  add("meta", "extraction_failed_count", summary.failedExtractionCount);

  for (const [status, count] of Object.entries(summary.statusCounts).sort(
    (a, b) => a[0].localeCompare(b[0]),
  )) {
    add("status", status, count);
  }

  for (const col of summary.scoreColumns) {
    add("average", col.column, formatAverage(col.average));
    for (const bucket of DISTRIBUTION_BUCKETS) {
      add("distribution", `${col.column}.${bucket}`, col.distribution[bucket]);
    }
  }

  summary.topReviewerNotes.forEach((entry, index) => {
    add(
      "reviewer_notes",
      `top_${index + 1}`,
      `${entry.note} (${entry.count})`,
    );
  });

  return `${lines.join("\n")}\n`;
}

export function writeScoreSummaryOutputs(
  summary: ReviewScoreSummary,
  inputPath: string,
  options: { writeJson?: boolean } = {},
): { csvOutputPath: string; jsonOutputPath: string } {
  ensureEvalDirs();

  const ts =
    timestampFromReviewQueuePath(inputPath) ?? runTimestampId();
  const csvOutputPath = join(EVAL_RESULTS_DIR, `score_summary_${ts}.csv`);
  const jsonOutputPath = join(EVAL_RESULTS_DIR, `score_summary_${ts}.json`);

  writeFileSync(csvOutputPath, scoreSummaryToCsv(summary), "utf8");

  if (options.writeJson !== false) {
    writeFileSync(jsonOutputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  }

  return { csvOutputPath, jsonOutputPath };
}

export function summarizeReviewQueueFile(
  inputPath: string,
  options: { strict?: boolean; writeJson?: boolean } = {},
): SummarizeReviewScoresResult {
  const summary = summarizeReviewQueueCsv(inputPath, { strict: options.strict });
  const { csvOutputPath, jsonOutputPath } = writeScoreSummaryOutputs(
    summary,
    inputPath,
    { writeJson: options.writeJson },
  );

  return {
    inputPath,
    csvOutputPath,
    jsonOutputPath,
    summary,
  };
}

export function printScoreSummaryWarnings(
  warnings: ReviewScoreSummary["invalidScoreWarnings"],
): void {
  if (warnings.length === 0) return;
  console.log("  Score warnings:");
  for (const w of warnings) {
    console.log(`    row ${w.row}, ${w.column}: invalid value "${w.value}"`);
  }
}

export function printScoreSummaryResult(result: SummarizeReviewScoresResult): void {
  const { summary } = result;

  console.log("Historical review score summary");
  console.log(`  Input:  ${result.inputPath}`);
  console.log(`  Rows:   ${summary.totalRows}`);
  console.log(
    `  Overall scored: ${summary.rowsWithOverallScore} · missing: ${summary.rowsMissingOverallScore}`,
  );
  console.log(
    `  Extraction: ${summary.successExtractionCount} success · ${summary.failedExtractionCount} failed`,
  );
  console.log(
    `  Reviewer notes: ${summary.reviewerNotesNonEmptyCount} non-empty`,
  );

  if (Object.keys(summary.statusCounts).length > 0) {
    console.log("  Status counts:");
    for (const [status, count] of Object.entries(summary.statusCounts).sort(
      (a, b) => a[0].localeCompare(b[0]),
    )) {
      console.log(`    ${status}: ${count}`);
    }
  }

  console.log("  Averages (numeric scores only):");
  for (const col of summary.scoreColumns) {
    const avg =
      col.average === null ? "—" : col.average.toFixed(2).replace(/\.?0+$/, "");
    console.log(`    ${col.column}: ${avg}`);
  }

  if (summary.topReviewerNotes.length > 0) {
    console.log("  Top reviewer notes:");
    for (const entry of summary.topReviewerNotes) {
      console.log(`    (${entry.count}) ${entry.note}`);
    }
  }

  printScoreSummaryWarnings(summary.invalidScoreWarnings);

  console.log(`  CSV:  ${result.csvOutputPath}`);
  console.log(`  JSON: ${result.jsonOutputPath}`);
}
