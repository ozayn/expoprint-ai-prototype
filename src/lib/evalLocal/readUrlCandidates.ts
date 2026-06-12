import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalDomainFromHost } from "./canonicalDomain";
import { isEvalViewerEnabled } from "./isEvalViewerEnabled";
import { isSafeUrlCandidatesFilename } from "./listEvalFiles";
import { csvRowsToObjects, parseCsv } from "./parseCsv";
import {
  URL_CANDIDATE_COLUMNS,
  type UrlCandidateRow,
} from "./urlCandidateTypes";

/** Count data rows in a URL candidates CSV (handles multiline fields). */
export function countUrlCandidatesCsvRows(text: string): number {
  const { records } = csvRowsToObjects(parseCsv(text));
  return records.length;
}

const EVAL_RESULTS_DIR = join(process.cwd(), "data", "eval", "results");

export async function readUrlCandidatesFromDir(
  resultsDir: string,
  filename: string,
  isSafeFilename: (name: string) => boolean,
): Promise<{ filename: string; rows: UrlCandidateRow[] } | null> {
  if (!isSafeFilename(filename)) return null;

  const path = join(resultsDir, filename);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    return null;
  }

  const { records } = csvRowsToObjects(parseCsv(text));
  const rows: UrlCandidateRow[] = records.map((record) => {
    const row = {} as UrlCandidateRow;
    for (const col of URL_CANDIDATE_COLUMNS) {
      row[col] = record[col] ?? "";
    }
    if (!row.canonical_domain.trim() && row.domain.trim()) {
      row.canonical_domain = canonicalDomainFromHost(row.domain);
    }
    return row;
  });

  return { filename, rows };
}

export async function readUrlCandidatesCsv(
  filename: string,
): Promise<{ filename: string; rows: UrlCandidateRow[] } | null> {
  if (!isEvalViewerEnabled()) return null;
  return readUrlCandidatesFromDir(
    EVAL_RESULTS_DIR,
    filename,
    isSafeUrlCandidatesFilename,
  );
}
