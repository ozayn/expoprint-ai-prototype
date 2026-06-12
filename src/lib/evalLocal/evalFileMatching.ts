import { timestampFromEvalArtifactName } from "./evalRunId";

export type EvalArtifactRef = { name: string };

export function timestampFromEvalArtifact(name: string): string | null {
  return timestampFromEvalArtifactName(name);
}

export function matchingExtractionRun<T extends EvalArtifactRef>(
  runs: T[],
  summaryName?: string,
): T | undefined {
  if (summaryName) {
    const ts = timestampFromEvalArtifact(summaryName);
    if (ts) {
      const match = runs.find(
        (r) =>
          r.name === `extraction_run_${ts}.jsonl` ||
          r.name === `manual_extraction_run_${ts}.jsonl`,
      );
      if (match) return match;
    }
  }
  return runs[0];
}

export function matchingReviewQueue<T extends EvalArtifactRef>(
  queues: T[],
  summaryName?: string,
  runName?: string,
): T | undefined {
  for (const source of [summaryName, runName]) {
    if (!source) continue;
    const ts = timestampFromEvalArtifactName(source);
    if (ts) {
      const match = queues.find(
        (q) =>
          q.name === `review_queue_${ts}.csv` ||
          q.name === `manual_review_queue_${ts}.csv`,
      );
      if (match) return match;
    }
  }
  return queues[0];
}
