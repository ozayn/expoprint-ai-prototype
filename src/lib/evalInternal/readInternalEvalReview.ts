import { access, readFile } from "node:fs/promises";
import {
  REVIEW_QUEUE_ALL_COLUMNS,
  type ReviewQueueRow,
} from "@/lib/evalLocal/reviewQueueTypes";
import {
  INTERNAL_EVAL_REVIEW_FILENAME,
  INTERNAL_EVAL_REVIEW_PATH,
  PUBLIC_SAMPLE_REVIEW_FILENAME,
  PUBLIC_SAMPLE_REVIEW_PATH,
} from "./constants";

type ReviewJsonFile = {
  rows?: unknown;
  description?: string;
};

export type InternalEvalReviewSource = "published" | "sample";

function emptyRow(): ReviewQueueRow {
  return Object.fromEntries(
    REVIEW_QUEUE_ALL_COLUMNS.map((col) => [col, ""]),
  ) as ReviewQueueRow;
}

function normalizeRow(value: unknown): ReviewQueueRow | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const row = emptyRow();
  for (const col of REVIEW_QUEUE_ALL_COLUMNS) {
    const cell = record[col];
    if (cell === undefined || cell === null) continue;
    if (typeof cell === "string" || typeof cell === "number") {
      row[col] = String(cell);
    }
  }
  return row;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readReviewJsonFile(
  path: string,
  filename: string,
): Promise<{ filename: string; rows: ReviewQueueRow[] }> {
  const raw = await readFile(path, "utf8");
  let parsed: ReviewJsonFile;
  try {
    parsed = JSON.parse(raw) as ReviewJsonFile;
  } catch {
    throw new Error(`Invalid review JSON fixture: ${filename}`);
  }

  if (!Array.isArray(parsed.rows)) {
    throw new Error(`Review JSON must include a rows array: ${filename}`);
  }

  const rows = parsed.rows
    .map(normalizeRow)
    .filter((row): row is ReviewQueueRow => row !== null);

  return { filename, rows };
}

/**
 * Reads published sanitized eval data for /internal/eval.
 * Prefers data/eval/public/internal-eval-review.json, then public-sample-review.json.
 * Never reads data/eval/results, runs/, or data/private/.
 */
export async function readInternalEvalReview(): Promise<{
  filename: string;
  rows: ReviewQueueRow[];
  source: InternalEvalReviewSource;
}> {
  if (await pathExists(INTERNAL_EVAL_REVIEW_PATH)) {
    const data = await readReviewJsonFile(
      INTERNAL_EVAL_REVIEW_PATH,
      INTERNAL_EVAL_REVIEW_FILENAME,
    );
    return { ...data, source: "published" };
  }

  const data = await readReviewJsonFile(
    PUBLIC_SAMPLE_REVIEW_PATH,
    PUBLIC_SAMPLE_REVIEW_FILENAME,
  );
  return { ...data, source: "sample" };
}
