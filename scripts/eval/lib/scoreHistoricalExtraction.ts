import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EVAL_RESULTS_DIR, ensureEvalDirs } from "./paths.js";
import { fieldScoresToCsv, scoreHistoricalRunRecord } from "./scoreUtils.js";
import type { FieldScoreRow, HistoricalRunRecord } from "./types.js";

export function readRunJsonl(runPath: string): HistoricalRunRecord[] {
  const text = readFileSync(runPath, "utf8");
  const records: HistoricalRunRecord[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    records.push(JSON.parse(trimmed) as HistoricalRunRecord);
  }
  return records;
}

export function scoreRunRecords(records: HistoricalRunRecord[]): FieldScoreRow[] {
  return records.flatMap((record) => scoreHistoricalRunRecord(record));
}

export function writeScoreResultsCsv(
  rows: FieldScoreRow[],
  runId: string,
): string {
  ensureEvalDirs();
  const outPath = join(EVAL_RESULTS_DIR, `results_${runId}.csv`);
  writeFileSync(outPath, fieldScoresToCsv(rows), "utf8");
  return outPath;
}

/** Score a JSONL run file and write `data/eval/results/results_<run_id>.csv`. */
export async function scoreHistoricalRunFile(
  runPath: string,
  runId?: string,
): Promise<{ outPath: string; rowCount: number }> {
  const records = readRunJsonl(runPath);
  const id = runId ?? records[0]?.run_id ?? "unknown";
  const scores = scoreRunRecords(records);
  const outPath = writeScoreResultsCsv(scores, id);
  return { outPath, rowCount: scores.length };
}

/** Score from in-memory records (used by run harness). */
export function scoreAndWriteResults(
  records: HistoricalRunRecord[],
  runId: string,
): string {
  const scores = scoreRunRecords(records);
  return writeScoreResultsCsv(scores, runId);
}
