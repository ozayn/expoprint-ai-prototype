import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalDomainFromHost } from "./canonicalDomain";
import {
  EXTRACTION_SUMMARY_TABLE_COLUMNS,
  type ExtractionSummaryRow,
} from "./extractionSummaryTypes";
import { isEvalViewerEnabled } from "./isEvalViewerEnabled";
import { isSafeSummaryFilename } from "./listEvalFiles";
import { csvRowsToObjects, parseCsv } from "./parseCsv";

export {
  EXTRACTION_SUMMARY_TABLE_COLUMNS,
  type ExtractionSummaryRow,
} from "./extractionSummaryTypes";

const EVAL_RESULTS_DIR = join(process.cwd(), "data", "eval", "results");

export async function readExtractionSummaryFromDir(
  resultsDir: string,
  filename: string,
  isSafeFilename: (name: string) => boolean,
): Promise<{ filename: string; rows: ExtractionSummaryRow[] } | null> {
  if (!isSafeFilename(filename)) return null;

  const path = join(resultsDir, filename);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    return null;
  }

  const { records } = csvRowsToObjects(parseCsv(text));
  const rows: ExtractionSummaryRow[] = records.map((record) => {
    const row = {} as ExtractionSummaryRow;
    for (const col of EXTRACTION_SUMMARY_TABLE_COLUMNS) {
      row[col] = record[col] ?? "";
    }
    if (!row.canonical_domain.trim() && row.domain.trim()) {
      row.canonical_domain = canonicalDomainFromHost(row.domain);
    }
    const pages = record.pages_inspected?.trim();
    if (pages) row.pages_inspected = pages;
    return row;
  });

  return { filename, rows };
}

export async function readExtractionSummaryCsv(
  filename: string,
): Promise<{ filename: string; rows: ExtractionSummaryRow[] } | null> {
  if (!isEvalViewerEnabled()) return null;
  return readExtractionSummaryFromDir(
    EVAL_RESULTS_DIR,
    filename,
    isSafeSummaryFilename,
  );
}
