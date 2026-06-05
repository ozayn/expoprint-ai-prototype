import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isEvalViewerEnabled } from "./isEvalViewerEnabled";
import { isSafeScoreSummaryFilename } from "./listEvalFiles";
import { csvRowsToObjects, parseCsv } from "./parseCsv";
import type { ParsedScoreSummary } from "./scoreSummaryTypes";

const EVAL_RESULTS_DIR = join(process.cwd(), "data", "eval", "results");

function parseMetricInt(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function readScoreSummaryFromDir(
  resultsDir: string,
  filename: string,
  isSafeFilename: (name: string) => boolean,
): Promise<ParsedScoreSummary | null> {
  if (!isSafeFilename(filename)) return null;

  const path = join(resultsDir, filename);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    return null;
  }

  const { records } = csvRowsToObjects(parseCsv(text));
  const meta: Record<string, string> = {};
  const averages: Record<string, string> = {};
  const statusCounts: Record<string, number> = {};
  const topReviewerNotes: string[] = [];

  for (const row of records) {
    const section = (row.section ?? "").trim();
    const key = (row.key ?? "").trim();
    const value = (row.value ?? "").trim();
    if (!section || !key) continue;

    if (section === "meta") meta[key] = value;
    if (section === "average") averages[key] = value;
    if (section === "status") statusCounts[key] = parseMetricInt(value);
    if (section === "reviewer_notes" && key.startsWith("top_")) {
      topReviewerNotes.push(value);
    }
  }

  return {
    filename,
    inputFile: meta.input_file ?? "",
    totalRows: parseMetricInt(meta.total_rows ?? "0"),
    rowsWithOverallScore: parseMetricInt(meta.rows_with_overall_score ?? "0"),
    rowsMissingOverallScore: parseMetricInt(meta.rows_missing_overall_score ?? "0"),
    reviewerNotesNonEmptyCount: parseMetricInt(
      meta.reviewer_notes_non_empty_count ?? "0",
    ),
    extractionSuccessCount: parseMetricInt(meta.extraction_success_count ?? "0"),
    extractionFailedCount: parseMetricInt(meta.extraction_failed_count ?? "0"),
    averages,
    statusCounts,
    topReviewerNotes,
  };
}

export async function readScoreSummaryCsv(
  filename: string,
): Promise<ParsedScoreSummary | null> {
  if (!isEvalViewerEnabled()) return null;
  return readScoreSummaryFromDir(
    EVAL_RESULTS_DIR,
    filename,
    isSafeScoreSummaryFilename,
  );
}
