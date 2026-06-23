import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EVAL_RUN_ID_PATTERN } from "../../../src/lib/evalLocal/evalRunId.js";
import {
  canonicalSiteDedupeKeyFromFields,
  mergeBrandAuditRows,
  mergeDuplicateVariants,
  parseDuplicateVariants,
  pickBetterReviewRow,
  serializeDuplicateVariants,
  variantFromReviewRow,
} from "../../../src/lib/evalLocal/evalCanonicalDedup.js";
import { shouldPreserveRicherContact } from "../../../src/lib/evalLocal/reviewRowMergeQuality.js";
import {
  evalRunIdToIso,
  extractionRunIdFromReviewQueueName,
} from "../../../src/lib/evalLocal/evalProcessedMeta.js";
import { normalizeStatusValue } from "../../../src/lib/evalLocal/normalizeEvalStatus.js";
import { csvRowsToObjects, parseCsv } from "./parseCsv.js";
import {
  REVIEW_QUEUE_COLUMNS,
  type ReviewQueueRow,
} from "./historicalReviewQueue.js";
import { EVAL_RESULTS_DIR, ensureEvalDirs, runTimestampId } from "./paths.js";
import { escapeCsvCell } from "./urlCandidates.js";

export const COMBINED_REVIEW_QUEUE_PREFIX = "review_queue_combined_";

export const COMBINED_REVIEW_MERGE_COLUMNS = [
  "latest_rerun_status",
  "latest_rerun_timestamp",
  "preserved_previous_success",
  "preserved_richer_contact",
] as const;

export const COMBINED_REVIEW_QUEUE_COLUMNS = [
  ...REVIEW_QUEUE_COLUMNS,
  ...COMBINED_REVIEW_MERGE_COLUMNS,
] as const;

export type CombinedReviewQueueRow = ReviewQueueRow & {
  source_review_queue: string;
  latest_rerun_status: string;
  latest_rerun_timestamp: string;
  preserved_previous_success: string;
  preserved_richer_contact: string;
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

export function listCombinedReviewQueueFilenames(
  resultsDir: string = EVAL_RESULTS_DIR,
): string[] {
  try {
    return readdirSync(resultsDir)
      .filter((name) => isCombinedReviewQueueFilename(name))
      .sort((a, b) =>
        timestampFromReviewQueueFilename(b).localeCompare(
          timestampFromReviewQueueFilename(a),
        ),
      );
  } catch {
    return [];
  }
}

export function findLatestCombinedReviewQueuePath(
  resultsDir: string = EVAL_RESULTS_DIR,
): string {
  const filenames = listCombinedReviewQueueFilenames(resultsDir);
  if (filenames.length === 0) {
    throw new Error(
      `No ${COMBINED_REVIEW_QUEUE_PREFIX}*.csv files found in ${resultsDir}`,
    );
  }
  return join(resultsDir, filenames[0]);
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

export function reviewQueueTimestampFromFilename(name: string): string {
  return timestampFromReviewQueueFilename(name);
}

function canonicalKeyForRow(row: ReviewQueueRow): string {
  const siteKey = canonicalSiteDedupeKeyFromFields({
    canonical_domain: row.canonical_domain,
    domain: row.domain,
    normalized_url: row.normalized_url,
  });
  if (siteKey) return siteKey;
  const ds = row.ds_number?.trim();
  if (ds) return `ds:${ds}`;
  return `row:${row.ds_id?.trim() || row.project_title?.trim() || Math.random()}`;
}

function reviewRowTimestampIso(row: ReviewQueueRow): string {
  const processedAt = row.processed_at?.trim();
  if (processedAt) return processedAt;

  const runId =
    row.extraction_run_id?.trim() ||
    extractionRunIdFromReviewQueueName(row.source_review_queue ?? "");
  if (runId) {
    const iso = evalRunIdToIso(runId);
    if (iso) return iso;
  }
  return "";
}

function reviewRowSortTimestamp(row: ReviewQueueRow): number {
  const processedAt = row.processed_at?.trim();
  if (processedAt) {
    const ms = Date.parse(processedAt);
    if (!Number.isNaN(ms)) return ms;
  }

  const runId =
    row.extraction_run_id?.trim() ||
    extractionRunIdFromReviewQueueName(row.source_review_queue ?? "");
  if (runId) {
    const iso = evalRunIdToIso(runId);
    if (iso) {
      const ms = Date.parse(iso);
      if (!Number.isNaN(ms)) return ms;
    }
    const numeric = Number(runId);
    if (!Number.isNaN(numeric)) return numeric;
  }

  return 0;
}

function newerReviewRow(a: ReviewQueueRow, b: ReviewQueueRow): ReviewQueueRow {
  return reviewRowSortTimestamp(a) >= reviewRowSortTimestamp(b) ? a : b;
}

function combinedRowFromBatch(
  row: ReviewQueueRow,
  filename: string,
): CombinedReviewQueueRow {
  return {
    ...row,
    source_review_queue: filename,
    latest_rerun_status: row.status?.trim() || "",
    latest_rerun_timestamp: reviewRowTimestampIso(row),
    preserved_previous_success: "",
    preserved_richer_contact: "",
  };
}

export function mergeCombinedReviewRows(
  existing: CombinedReviewQueueRow,
  incoming: CombinedReviewQueueRow,
): CombinedReviewQueueRow {
  const kept = pickBetterReviewRow(existing, incoming);
  const other = kept === existing ? incoming : existing;
  const merged = mergeBrandAuditRows(kept, other);

  const variants = mergeDuplicateVariants(
    [
      ...parseDuplicateVariants(existing.duplicate_source_urls),
      ...parseDuplicateVariants(incoming.duplicate_source_urls),
      ...parseDuplicateVariants(merged.duplicate_source_urls),
    ],
    [variantFromReviewRow(other)],
    variantFromReviewRow(kept),
  );

  const sourceReviewQueue =
    kept.source_review_queue?.trim() || incoming.source_review_queue?.trim() || "";

  const latestAttempt = newerReviewRow(existing, incoming);
  const olderAttempt = latestAttempt === existing ? incoming : existing;
  const latestOutcome = normalizeStatusValue(latestAttempt.status);
  const olderOutcome = normalizeStatusValue(olderAttempt.status);
  const preservedPreviousSuccess =
    olderOutcome === "success" &&
    latestOutcome === "failed" &&
    kept !== latestAttempt;
  const preservedRicherContact =
    olderOutcome === "success" &&
    latestOutcome === "success" &&
    shouldPreserveRicherContact(olderAttempt, latestAttempt) &&
    kept === olderAttempt;

  return {
    ...merged,
    source_review_queue: sourceReviewQueue,
    duplicate_source_urls: serializeDuplicateVariants(variants),
    latest_rerun_status: latestAttempt.status?.trim() || "",
    latest_rerun_timestamp: reviewRowTimestampIso(latestAttempt),
    preserved_previous_success: preservedPreviousSuccess ? "true" : "",
    preserved_richer_contact: preservedRicherContact ? "true" : "",
  };
}

function listBatchReviewQueueFiles(resultsDir: string): string[] {
  return readdirSync(resultsDir)
    .filter((name) => isBatchReviewQueueFilename(name))
    .sort((a, b) => timestampFromReviewQueueFilename(a).localeCompare(
      timestampFromReviewQueueFilename(b),
    ));
}

export function listBatchReviewQueueFilenames(
  resultsDir: string = EVAL_RESULTS_DIR,
): string[] {
  return listBatchReviewQueueFiles(resultsDir);
}

export function findLatestBatchReviewQueueFilename(
  resultsDir: string = EVAL_RESULTS_DIR,
): string {
  const files = listBatchReviewQueueFilenames(resultsDir);
  if (files.length === 0) {
    throw new Error(`No batch review_queue_*.csv files found in ${resultsDir}`);
  }
  return files[files.length - 1];
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

export function readReviewQueueCsvFromResults(
  resultsDir: string,
  filename: string,
): ReviewQueueRow[] {
  return readReviewQueueCsv(resultsDir, filename);
}

export function readCombinedReviewQueueCsv(filePath: string): ReviewQueueRow[] {
  const text = readFileSync(filePath, "utf8");
  const { records } = csvRowsToObjects(parseCsv(text));
  return records.map((record) => {
    const row = {} as ReviewQueueRow;
    for (const col of COMBINED_REVIEW_QUEUE_COLUMNS) {
      if (col in record) {
        row[col as keyof ReviewQueueRow] = record[col] ?? "";
      }
    }
    for (const col of REVIEW_QUEUE_COLUMNS) {
      if (!row[col]?.trim()) {
        row[col] = record[col] ?? "";
      }
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

export function mergeBatchReviewQueuesInMemory(
  resultsDir: string = EVAL_RESULTS_DIR,
  options?: { excludeFilenames?: string[] },
): {
  rows: CombinedReviewQueueRow[];
  sourceFiles: string[];
  rowsRead: number;
} {
  const exclude = new Set(options?.excludeFilenames ?? []);
  const sourceFiles = listBatchReviewQueueFiles(resultsDir).filter(
    (name) => !exclude.has(name),
  );
  if (sourceFiles.length === 0) {
    return { rows: [], sourceFiles: [], rowsRead: 0 };
  }

  const merged = new Map<string, CombinedReviewQueueRow>();
  let rowsRead = 0;

  for (const filename of sourceFiles) {
    const rows = readReviewQueueCsv(resultsDir, filename);
    for (const row of rows) {
      rowsRead += 1;
      const incoming = combinedRowFromBatch(row, filename);
      const key = canonicalKeyForRow(row);
      const existing = merged.get(key);
      if (existing) {
        merged.set(key, mergeCombinedReviewRows(existing, incoming));
      } else {
        merged.set(key, incoming);
      }
    }
  }

  const combinedRows = [...merged.values()].sort((a, b) =>
    a.normalized_url.localeCompare(b.normalized_url),
  );

  return { rows: combinedRows, sourceFiles, rowsRead };
}

export function combineReviewQueues(
  resultsDir: string = EVAL_RESULTS_DIR,
): CombineReviewQueuesResult {
  ensureEvalDirs();

  const { rows: combinedRows, sourceFiles, rowsRead } =
    mergeBatchReviewQueuesInMemory(resultsDir);

  if (sourceFiles.length === 0) {
    throw new Error(
      `No batch review_queue_*.csv files found in ${resultsDir}`,
    );
  }

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
