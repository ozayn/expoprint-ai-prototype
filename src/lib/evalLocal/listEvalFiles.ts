import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { isEvalViewerEnabled } from "./isEvalViewerEnabled";
import { csvRowsToObjects, parseCsv } from "./parseCsv";

export type EvalFileKind =
  | "url_candidates"
  | "extraction_summary"
  | "review_queue"
  | "score_summary"
  | "extraction_run";

export type EvalFileEntry = {
  name: string;
  kind: EvalFileKind;
  /** Relative path under repo root (display only). */
  relativePath: string;
  mtimeMs: number;
  sizeBytes: number;
  /** Parsed CSV data rows (url_candidates files only). */
  rowCount?: number;
};

/** Smoke-test / example URL candidate files are tiny and should not win default selection. */
export const MIN_SUBSTANTIAL_URL_CANDIDATES_ROWS = 50;

export type LocalEvalFileIndex = {
  urlCandidates: EvalFileEntry[];
  extractionSummaries: EvalFileEntry[];
  reviewQueues: EvalFileEntry[];
  scoreSummaries: EvalFileEntry[];
  extractionRuns: EvalFileEntry[];
};

const EVAL_RESULTS_DIR = join(process.cwd(), "data", "eval", "results");
const EVAL_RUNS_DIR = join(process.cwd(), "data", "eval", "runs");

function classifyFilename(name: string): EvalFileKind | null {
  if (name.startsWith("url_candidates_") && name.endsWith(".csv")) {
    return "url_candidates";
  }
  if (
    (name.startsWith("extraction_summary_") ||
      name.startsWith("manual_extraction_summary_")) &&
    name.endsWith(".csv")
  ) {
    return "extraction_summary";
  }
  if (
    (name.startsWith("review_queue_") || name.startsWith("manual_review_queue_")) &&
    name.endsWith(".csv")
  ) {
    return "review_queue";
  }
  if (name.startsWith("score_summary_") && name.endsWith(".csv")) {
    return "score_summary";
  }
  if (
    (name.startsWith("extraction_run_") ||
      name.startsWith("manual_extraction_run_")) &&
    name.endsWith(".jsonl")
  ) {
    return "extraction_run";
  }
  return null;
}

function sortNewestFirst(entries: EvalFileEntry[]): EvalFileEntry[] {
  return [...entries].sort((a, b) => b.mtimeMs - a.mtimeMs);
}

async function scanDir(
  absoluteDir: string,
  relativePrefix: string,
): Promise<EvalFileEntry[]> {
  let names: string[];
  try {
    names = await readdir(absoluteDir);
  } catch {
    return [];
  }

  const entries: EvalFileEntry[] = [];
  for (const name of names) {
    const kind = classifyFilename(name);
    if (!kind) continue;

    const absolutePath = join(absoluteDir, name);
    try {
      const st = await stat(absolutePath);
      if (!st.isFile()) continue;
      entries.push({
        name,
        kind,
        relativePath: `${relativePrefix}/${name}`,
        mtimeMs: st.mtimeMs,
        sizeBytes: st.size,
      });
    } catch {
      // skip unreadable
    }
  }
  return entries;
}

/**
 * Lists gitignored historical eval artifacts under data/eval/.
 * Returns empty lists when the viewer is disabled (production).
 */
export async function listLocalEvalFiles(): Promise<LocalEvalFileIndex> {
  if (!isEvalViewerEnabled()) {
    return {
      urlCandidates: [],
      extractionSummaries: [],
      reviewQueues: [],
      scoreSummaries: [],
      extractionRuns: [],
    };
  }

  const [resultsEntries, runsEntries] = await Promise.all([
    scanDir(EVAL_RESULTS_DIR, "data/eval/results"),
    scanDir(EVAL_RUNS_DIR, "data/eval/runs"),
  ]);

  const urlCandidates: EvalFileEntry[] = [];
  const extractionSummaries: EvalFileEntry[] = [];
  const reviewQueues: EvalFileEntry[] = [];
  const scoreSummaries: EvalFileEntry[] = [];
  const extractionRuns: EvalFileEntry[] = [];

  for (const entry of resultsEntries) {
    if (entry.kind === "url_candidates") urlCandidates.push(entry);
    if (entry.kind === "extraction_summary") extractionSummaries.push(entry);
    if (entry.kind === "review_queue") reviewQueues.push(entry);
    if (entry.kind === "score_summary") scoreSummaries.push(entry);
  }

  for (const entry of runsEntries) {
    if (entry.kind === "extraction_run") extractionRuns.push(entry);
  }

  const urlCandidatesWithCounts = await enrichUrlCandidateRowCounts(urlCandidates);

  return {
    urlCandidates: sortNewestFirst(urlCandidatesWithCounts),
    extractionSummaries: sortNewestFirst(extractionSummaries),
    reviewQueues: sortNewestFirst(reviewQueues),
    scoreSummaries: sortNewestFirst(scoreSummaries),
    extractionRuns: sortNewestFirst(extractionRuns),
  };
}

function countUrlCandidatesRowsInText(text: string): number {
  const { records } = csvRowsToObjects(parseCsv(text));
  return records.length;
}

async function enrichUrlCandidateRowCounts(
  entries: EvalFileEntry[],
): Promise<EvalFileEntry[]> {
  return Promise.all(
    entries.map(async (entry) => {
      try {
        const text = await readFile(join(EVAL_RESULTS_DIR, entry.name), "utf8");
        return {
          ...entry,
          rowCount: countUrlCandidatesRowsInText(text),
        };
      } catch {
        return entry;
      }
    }),
  );
}

export function isSmokeTestUrlCandidatesFile(entry: EvalFileEntry): boolean {
  const lower = entry.name.toLowerCase();
  if (
    lower.includes("example") ||
    lower.includes("smoke") ||
    lower.includes("test")
  ) {
    return true;
  }
  if (
    entry.rowCount !== undefined &&
    entry.rowCount < MIN_SUBSTANTIAL_URL_CANDIDATES_ROWS
  ) {
    return true;
  }
  return false;
}

function pickLargestUrlCandidatesFile(candidates: EvalFileEntry[]): EvalFileEntry {
  return candidates.reduce((best, cur) => {
    const bestRows = best.rowCount ?? 0;
    const curRows = cur.rowCount ?? 0;
    if (curRows !== bestRows) return curRows > bestRows ? cur : best;
    if (cur.sizeBytes !== best.sizeBytes) {
      return cur.sizeBytes > best.sizeBytes ? cur : best;
    }
    return cur.mtimeMs > best.mtimeMs ? cur : best;
  });
}

export function pickUrlCandidatesFilename(
  candidates: EvalFileEntry[],
  requested: string | undefined,
): string | undefined {
  if (candidates.length === 0) return undefined;
  const allowed = new Set(candidates.map((c) => c.name));
  if (requested && allowed.has(requested)) return requested;

  const substantial = candidates.filter((c) => !isSmokeTestUrlCandidatesFile(c));
  const pool = substantial.length > 0 ? substantial : candidates;
  return pickLargestUrlCandidatesFile(pool).name;
}

export function isSafeUrlCandidatesFilename(name: string): boolean {
  return /^url_candidates_\d+\.csv$/.test(name);
}

export function pickSummaryFilename(
  summaries: EvalFileEntry[],
  requested: string | undefined,
): string | undefined {
  if (summaries.length === 0) return undefined;
  const allowed = new Set(summaries.map((s) => s.name));
  if (requested && allowed.has(requested)) return requested;
  return summaries[0]?.name;
}

export function isSafeSummaryFilename(name: string): boolean {
  return (
    /^extraction_summary_\d+\.csv$/.test(name) ||
    /^manual_extraction_summary_\d+\.csv$/.test(name)
  );
}

export function pickReviewQueueFilename(
  queues: EvalFileEntry[],
  requested: string | undefined,
): string | undefined {
  if (queues.length === 0) return undefined;
  const allowed = new Set(queues.map((q) => q.name));
  if (requested && allowed.has(requested)) return requested;
  return queues[0]?.name;
}

export function isSafeReviewQueueFilename(name: string): boolean {
  return (
    /^review_queue_\d+\.csv$/.test(name) ||
    /^manual_review_queue_\d+\.csv$/.test(name)
  );
}

export { matchingReviewQueue } from "./evalFileMatching";

export function isSafeScoreSummaryFilename(name: string): boolean {
  return /^score_summary_\d+\.csv$/.test(name);
}

export function pickScoreSummaryFilename(
  summaries: EvalFileEntry[],
  requested: string | undefined,
  reviewName?: string,
): string | undefined {
  if (summaries.length === 0) return undefined;
  const allowed = new Set(summaries.map((s) => s.name));
  if (requested && allowed.has(requested)) return requested;

  if (reviewName) {
    const m = reviewName.match(/_(20\d{12})\.csv$/);
    const ts = m?.[1];
    if (ts) {
      const match = `score_summary_${ts}.csv`;
      if (allowed.has(match)) return match;
    }
  }

  return summaries[0]?.name;
}
