import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  MIN_SUBSTANTIAL_URL_CANDIDATES_ROWS,
  pickUrlCandidatesFilename,
  type EvalFileEntry,
} from "../../../src/lib/evalLocal/listEvalFiles.js";
import { canonicalDomainFromHost } from "../../../src/lib/evalLocal/canonicalDomain.js";
import { isSafeUrlCandidatesFilename } from "../../../src/lib/evalLocal/listEvalFiles.js";
import { csvRowsToObjects, parseCsv } from "../../../src/lib/evalLocal/parseCsv.js";
import {
  URL_CANDIDATE_COLUMNS,
  type UrlCandidateRow,
} from "../../../src/lib/evalLocal/urlCandidateTypes.js";
import { countUrlCandidatesCsvRows } from "../../../src/lib/evalLocal/readUrlCandidates.js";
import { EVAL_RESULTS_DIR } from "./paths.js";

export function readUrlCandidatesCsvSync(
  resultsDir: string,
  filename: string,
): UrlCandidateRow[] {
  if (!isSafeUrlCandidatesFilename(filename)) {
    throw new Error(`Unsafe url_candidates filename: ${filename}`);
  }

  const path = join(resultsDir, filename);
  const text = readFileSync(path, "utf8");
  const { records } = csvRowsToObjects(parseCsv(text));

  return records.map((record) => {
    const row = {} as UrlCandidateRow;
    for (const col of URL_CANDIDATE_COLUMNS) {
      row[col] = record[col] ?? "";
    }
    if (!row.canonical_domain.trim() && row.domain.trim()) {
      row.canonical_domain = canonicalDomainFromHost(row.domain);
    }
    return row;
  });
}

export function listUrlCandidateEntriesSync(
  resultsDir: string = EVAL_RESULTS_DIR,
): EvalFileEntry[] {
  let names: string[];
  try {
    names = readdirSync(resultsDir);
  } catch {
    return [];
  }

  const entries: EvalFileEntry[] = [];
  for (const name of names) {
    if (!name.startsWith("url_candidates_") || !name.endsWith(".csv")) {
      continue;
    }

    const absolutePath = join(resultsDir, name);
    try {
      const st = statSync(absolutePath);
      if (!st.isFile()) continue;
      const text = readFileSync(absolutePath, "utf8");
      entries.push({
        name,
        kind: "url_candidates",
        relativePath: `data/eval/results/${name}`,
        mtimeMs: st.mtimeMs,
        sizeBytes: st.size,
        rowCount: countUrlCandidatesCsvRows(text),
      });
    } catch {
      continue;
    }
  }

  return entries.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

export function pickUrlCandidatesFilePath(
  resultsDir: string = EVAL_RESULTS_DIR,
  requestedFilename?: string,
): { path: string; filename: string; rowCount: number } {
  const entries = listUrlCandidateEntriesSync(resultsDir);
  if (entries.length === 0) {
    throw new Error(
      `No url_candidates_*.csv files found in ${resultsDir}. Run npm run eval:urls first.`,
    );
  }

  const filename = pickUrlCandidatesFilename(entries, requestedFilename);
  if (!filename) {
    throw new Error(`No url_candidates file selected in ${resultsDir}.`);
  }

  const entry = entries.find((e) => e.name === filename);
  const path = join(resultsDir, filename);
  const rowCount =
    entry?.rowCount ??
    countUrlCandidatesCsvRows(readFileSync(path, "utf8"));

  if (rowCount < MIN_SUBSTANTIAL_URL_CANDIDATES_ROWS) {
    console.warn(
      `Warning: selected url_candidates file has only ${rowCount} rows (smoke-test files are skipped when larger files exist).`,
    );
  }

  return { path, filename, rowCount };
}
