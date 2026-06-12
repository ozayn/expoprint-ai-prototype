import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  emptyBrandAuditRow,
  type BrandAuditRow,
} from "./brandAuditRow";
import { canonicalDomainFromHost } from "./canonicalDomain";
import { isEvalViewerEnabled } from "./isEvalViewerEnabled";
import { isSafeReviewQueueFilename } from "./listEvalFiles";
import { csvRowsToObjects, parseCsv } from "./parseCsv";
import type { ReviewQueueRow } from "./reviewQueueTypes";

export {
  REVIEW_QUEUE_VISIBLE_COLUMNS,
  type ReviewQueueRow,
} from "./reviewQueueTypes";

const EVAL_RESULTS_DIR = join(process.cwd(), "data", "eval", "results");

export async function readReviewQueueFromDir(
  resultsDir: string,
  filename: string,
  isSafeFilename: (name: string) => boolean,
): Promise<{ filename: string; rows: ReviewQueueRow[] } | null> {
  if (!isSafeFilename(filename)) return null;

  const path = join(resultsDir, filename);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    return null;
  }

  const { records } = csvRowsToObjects(parseCsv(text));
  const rows: BrandAuditRow[] = records.map((record) => {
    const row = emptyBrandAuditRow();
    for (const col of Object.keys(row) as (keyof BrandAuditRow)[]) {
      row[col] = record[col] ?? "";
    }
    if (!row.canonical_domain.trim() && row.domain.trim()) {
      row.canonical_domain = canonicalDomainFromHost(row.domain);
    }
    return row;
  });

  return { filename, rows };
}

export async function readReviewQueueCsv(
  filename: string,
): Promise<{ filename: string; rows: ReviewQueueRow[] } | null> {
  if (!isEvalViewerEnabled()) return null;
  return readReviewQueueFromDir(
    EVAL_RESULTS_DIR,
    filename,
    isSafeReviewQueueFilename,
  );
}
