import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { isEvalViewerEnabled } from "./isEvalViewerEnabled";

export type EvalFileKind =
  | "url_candidates"
  | "extraction_summary"
  | "review_queue"
  | "extraction_run";

export type EvalFileEntry = {
  name: string;
  kind: EvalFileKind;
  /** Relative path under repo root (display only). */
  relativePath: string;
  mtimeMs: number;
  sizeBytes: number;
};

export type LocalEvalFileIndex = {
  urlCandidates: EvalFileEntry[];
  extractionSummaries: EvalFileEntry[];
  reviewQueues: EvalFileEntry[];
  extractionRuns: EvalFileEntry[];
};

const EVAL_RESULTS_DIR = join(process.cwd(), "data", "eval", "results");
const EVAL_RUNS_DIR = join(process.cwd(), "data", "eval", "runs");

function classifyFilename(name: string): EvalFileKind | null {
  if (name.startsWith("url_candidates_") && name.endsWith(".csv")) {
    return "url_candidates";
  }
  if (name.startsWith("extraction_summary_") && name.endsWith(".csv")) {
    return "extraction_summary";
  }
  if (name.startsWith("review_queue_") && name.endsWith(".csv")) {
    return "review_queue";
  }
  if (name.startsWith("extraction_run_") && name.endsWith(".jsonl")) {
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
  const extractionRuns: EvalFileEntry[] = [];

  for (const entry of resultsEntries) {
    if (entry.kind === "url_candidates") urlCandidates.push(entry);
    if (entry.kind === "extraction_summary") extractionSummaries.push(entry);
    if (entry.kind === "review_queue") reviewQueues.push(entry);
  }

  for (const entry of runsEntries) {
    if (entry.kind === "extraction_run") extractionRuns.push(entry);
  }

  return {
    urlCandidates: sortNewestFirst(urlCandidates),
    extractionSummaries: sortNewestFirst(extractionSummaries),
    reviewQueues: sortNewestFirst(reviewQueues),
    extractionRuns: sortNewestFirst(extractionRuns),
  };
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
  return /^extraction_summary_\d+\.csv$/.test(name);
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
  return /^review_queue_\d+\.csv$/.test(name);
}

export function matchingReviewQueue(
  queues: EvalFileEntry[],
  summaryName?: string,
  runName?: string,
): EvalFileEntry | undefined {
  for (const source of [summaryName, runName]) {
    if (!source) continue;
    const m = source.match(/_(20\d{12})\.(csv|jsonl)$/);
    const ts = m?.[1];
    if (ts) {
      const match = queues.find((q) => q.name === `review_queue_${ts}.csv`);
      if (match) return match;
    }
  }
  return queues[0];
}
