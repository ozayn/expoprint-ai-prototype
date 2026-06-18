import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseCsv, csvRowsToObjects } from "./parseCsv.js";
import {
  REVIEW_QUEUE_COLUMNS,
  type ReviewQueueRow,
} from "./historicalReviewQueue.js";

export function readReviewQueueCsvFromPath(filePath: string): ReviewQueueRow[] {
  const text = readFileSync(filePath, "utf8");
  const { records } = csvRowsToObjects(parseCsv(text));
  return records.map((record) => {
    const row = {} as ReviewQueueRow;
    for (const col of REVIEW_QUEUE_COLUMNS) {
      row[col] = record[col] ?? "";
    }
    return row;
  });
}

export function reviewQueueFilenameFromPath(filePath: string): string {
  return basename(filePath);
}
