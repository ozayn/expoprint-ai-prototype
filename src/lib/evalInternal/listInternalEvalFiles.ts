import { stat } from "node:fs/promises";
import { join } from "node:path";
import type {
  EvalFileEntry,
  EvalFileKind,
  LocalEvalFileIndex,
} from "@/lib/evalLocal/listEvalFiles";
import {
  INTERNAL_SAMPLE_DIR,
  INTERNAL_SAMPLE_FILES,
  isAllowedInternalSampleFile,
} from "./constants";

async function entryForFile(
  name: string,
  kind: EvalFileKind,
): Promise<EvalFileEntry | undefined> {
  if (!isAllowedInternalSampleFile(name)) return undefined;
  const absolutePath = join(INTERNAL_SAMPLE_DIR, name);
  try {
    const st = await stat(absolutePath);
    if (!st.isFile()) return undefined;
    return {
      name,
      kind,
      relativePath: `data/eval/internal-sample/${name}`,
      mtimeMs: st.mtimeMs,
      sizeBytes: st.size,
    };
  } catch {
    return undefined;
  }
}

/** Lists committed sample artifacts for the deployed internal viewer. */
export async function listInternalEvalFiles(): Promise<LocalEvalFileIndex> {
  const [url, summary, review, run] = await Promise.all([
    entryForFile(INTERNAL_SAMPLE_FILES.urlCandidates, "url_candidates"),
    entryForFile(INTERNAL_SAMPLE_FILES.extractionSummary, "extraction_summary"),
    entryForFile(INTERNAL_SAMPLE_FILES.reviewQueue, "review_queue"),
    entryForFile(INTERNAL_SAMPLE_FILES.extractionRun, "extraction_run"),
  ]);

  return {
    urlCandidates: url ? [url] : [],
    extractionSummaries: summary ? [summary] : [],
    reviewQueues: review ? [review] : [],
    extractionRuns: run ? [run] : [],
  };
}
