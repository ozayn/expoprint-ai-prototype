import { readFile } from "node:fs/promises";
import {
  REVIEW_QUEUE_ALL_COLUMNS,
  type ReviewQueueRow,
} from "@/lib/evalLocal/reviewQueueTypes";
import {
  PUBLIC_SAMPLE_REVIEW_FILENAME,
  PUBLIC_SAMPLE_REVIEW_PATH,
} from "./constants";

type PublicSampleReviewFile = {
  rows?: unknown;
};

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

/** Reads the single whitelisted sanitized fixture for the deployed viewer. */
export async function readPublicSampleReview(): Promise<{
  filename: string;
  rows: ReviewQueueRow[];
}> {
  const raw = await readFile(PUBLIC_SAMPLE_REVIEW_PATH, "utf8");
  let parsed: PublicSampleReviewFile;
  try {
    parsed = JSON.parse(raw) as PublicSampleReviewFile;
  } catch {
    throw new Error("Invalid public sample review fixture JSON.");
  }

  if (!Array.isArray(parsed.rows)) {
    throw new Error("Public sample review fixture must include a rows array.");
  }

  const rows = parsed.rows
    .map(normalizeRow)
    .filter((row): row is ReviewQueueRow => row !== null);

  return {
    filename: PUBLIC_SAMPLE_REVIEW_FILENAME,
    rows,
  };
}
