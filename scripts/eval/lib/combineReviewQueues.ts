import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EVAL_RUN_ID_PATTERN } from "../../../src/lib/evalLocal/evalRunId.js";
import { normalizeEvalUrl } from "../../../src/lib/evalLocal/evalUrlDedup.js";
import { csvRowsToObjects, parseCsv } from "./parseCsv.js";
import {
  REVIEW_QUEUE_COLUMNS,
  type ReviewQueueRow,
} from "./historicalReviewQueue.js";
import { EVAL_RESULTS_DIR, ensureEvalDirs, runTimestampId } from "./paths.js";
import { escapeCsvCell } from "./urlCandidates.js";

export const COMBINED_REVIEW_QUEUE_PREFIX = "review_queue_combined_";

export const COMBINED_REVIEW_QUEUE_COLUMNS = [
  "source_review_queue",
  ...REVIEW_QUEUE_COLUMNS,
] as const;

export type CombinedReviewQueueRow = ReviewQueueRow & {
  source_review_queue: string;
};

export type CombineReviewQueuesResult = {
  outputPath: string;
  sourceFiles: string[];
  rowsRead: number;
  rowsWritten: number;
  duplicatesDropped: number;
};

const BATCH_REVIEW_QUEUE_RE = new RegExp(
  `^review_queue_${EVAL_RUN_ID_PATTERN}\\.csv$`,
);

export function isBatchReviewQueueFilename(name: string): boolean {
  return BATCH_REVIEW_QUEUE_RE.test(name);
}

export function isCombinedReviewQueueFilename(name: string): boolean {
  return new RegExp(`^${COMBINED_REVIEW_QUEUE_PREFIX}\\d+\\.csv$`).test(name);
}

function timestampFromReviewQueueFilename(name: string): string {
  const batch = name.match(
    new RegExp(`^review_queue_(${EVAL_RUN_ID_PATTERN})\\.csv$`),
  );
  if (batch?.[1]) return batch[1];
  const combined = name.match(
    new RegExp(`^${COMBINED_REVIEW_QUEUE_PREFIX}(\\d+)\\.csv$`),
  );
  return combined?.[1] ?? "";
}

function urlKeyForRow(row: ReviewQueueRow): string {
  const normalized = normalizeEvalUrl(row.normalized_url?.trim() ?? "");
  if (normalized) return `url:${normalized}`;
  const domain = row.canonical_domain?.trim().toLowerCase() || row.domain?.trim().toLowerCase();
  if (domain) return `domain:${domain}`;
  const ds = row.ds_number?.trim();
  if (ds) return `ds:${ds}`;
  return `row:${row.ds_id?.trim() || row.project_title?.trim() || Math.random()}`;
}

function listBatchReviewQueueFiles(resultsDir: string): string[] {
  return readdirSync(resultsDir)
    .filter((name) => isBatchReviewQueueFilename(name))
    .sort((a, b) => timestampFromReviewQueueFilename(a).localeCompare(
      timestampFromReviewQueueFilename(b),
    ));
}

function readReviewQueueCsv(
  resultsDir: string,
  filename: string,
): ReviewQueueRow[] {
  const text = readFileSync(join(resultsDir, filename), "utf8");
  const { records } = csvRowsToObjects(parseCsv(text));
  return records.map((record) => {
    const row = {} as ReviewQueueRow;
    for (const col of REVIEW_QUEUE_COLUMNS) {
      row[col] = record[col] ?? "";
    }
    return row;
  });
}

export function combinedReviewQueueToCsv(rows: CombinedReviewQueueRow[]): string {
  const lines = [COMBINED_REVIEW_QUEUE_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(
      COMBINED_REVIEW_QUEUE_COLUMNS.map((col) =>
        escapeCsvCell(row[col] ?? ""),
      ).join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function combineReviewQueues(
  resultsDir: string = EVAL_RESULTS_DIR,
): CombineReviewQueuesResult {
  ensureEvalDirs();

  const sourceFiles = listBatchReviewQueueFiles(resultsDir);
  if (sourceFiles.length === 0) {
    throw new Error(
      `No batch review_queue_*.csv files found in ${resultsDir}`,
    );
  }

  const merged = new Map<string, CombinedReviewQueueRow>();
  let rowsRead = 0;

  for (const filename of sourceFiles) {
    const rows = readReviewQueueCsv(resultsDir, filename);
    for (const row of rows) {
      rowsRead += 1;
      const key = urlKeyForRow(row);
      merged.set(key, {
        ...row,
        source_review_queue: filename,
      });
    }
  }

  const combinedRows = [...merged.values()].sort((a, b) =>
    a.normalized_url.localeCompare(b.normalized_url),
  );

  const runId = runTimestampId();
  const outputPath = join(
    resultsDir,
    `${COMBINED_REVIEW_QUEUE_PREFIX}${runId}.csv`,
  );
  writeFileSync(outputPath, combinedReviewQueueToCsv(combinedRows), "utf8");

  return {
    outputPath,
    sourceFiles,
    rowsRead,
    rowsWritten: combinedRows.length,
    duplicatesDropped: rowsRead - combinedRows.length,
  };
}

export function printCombineReviewQueuesSummary(
  result: CombineReviewQueuesResult,
): void {
  console.log("Combined review queues");
  console.log(`  Source files:        ${result.sourceFiles.length}`);
  for (const file of result.sourceFiles) {
    console.log(`    - ${file}`);
  }
  console.log(`  Rows read:           ${result.rowsRead}`);
  console.log(`  Rows written:        ${result.rowsWritten}`);
  console.log(`  Duplicates dropped:  ${result.duplicatesDropped}`);
  console.log(`  Output:              ${result.outputPath}`);
}
