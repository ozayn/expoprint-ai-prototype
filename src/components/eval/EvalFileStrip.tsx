import type { EvalFileEntry } from "@/lib/evalLocal/listEvalFiles";
import { matchingReviewQueue } from "@/lib/evalLocal/listEvalFiles";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMtime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FileMeta({ label, file }: { label: string; file?: EvalFileEntry }) {
  if (!file) {
    return (
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
          {label}
        </div>
        <div className="mt-0.5 text-sm text-zinc-400">—</div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </div>
      <div className="mt-0.5 truncate font-mono text-sm text-zinc-700" title={file.name}>
        {file.name}
      </div>
      <div className="mt-0.5 text-xs text-zinc-400">
        {formatMtime(file.mtimeMs)} · {formatBytes(file.sizeBytes)}
      </div>
    </div>
  );
}

function PreviousFileList({ files }: { files: EvalFileEntry[] }) {
  if (files.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5 text-xs text-zinc-500">
      {files.map((f) => (
        <li key={f.relativePath} className="flex flex-wrap items-baseline gap-x-2">
          <code className="font-mono text-zinc-600">{f.name}</code>
          <span className="text-zinc-400">
            {formatMtime(f.mtimeMs)} · {formatBytes(f.sizeBytes)}
          </span>
        </li>
      ))}
    </ul>
  );
}

type Props = {
  urlCandidates: EvalFileEntry[];
  extractionSummaries: EvalFileEntry[];
  reviewQueues: EvalFileEntry[];
  extractionRuns: EvalFileEntry[];
  activeSummaryName?: string;
  activeReviewName?: string;
};

export function timestampFromEvalArtifact(name: string): string | null {
  const m = name.match(/_(20\d{12})\.(csv|jsonl)$/);
  return m?.[1] ?? null;
}

export function matchingExtractionRun(
  runs: EvalFileEntry[],
  summaryName?: string,
): EvalFileEntry | undefined {
  if (summaryName) {
    const ts = timestampFromEvalArtifact(summaryName);
    if (ts) {
      const match = runs.find((r) => r.name === `extraction_run_${ts}.jsonl`);
      if (match) return match;
    }
  }
  return runs[0];
}

export function EvalFileStrip({
  urlCandidates,
  extractionSummaries,
  reviewQueues,
  extractionRuns,
  activeSummaryName,
  activeReviewName,
}: Props) {
  const activeSummary =
    extractionSummaries.find((f) => f.name === activeSummaryName) ??
    extractionSummaries[0];
  const activeRun = matchingExtractionRun(extractionRuns, activeSummary?.name);
  const activeReview =
    reviewQueues.find((f) => f.name === activeReviewName) ??
    matchingReviewQueue(reviewQueues, activeSummary?.name, activeRun?.name);

  const previousUrl = urlCandidates.slice(1);
  const previousSummaries = extractionSummaries.filter(
    (f) => f.name !== activeSummary?.name,
  );
  const previousRuns = extractionRuns.filter((f) => f.name !== activeRun?.name);
  const previousReviews = reviewQueues.filter(
    (f) => f.name !== activeReview?.name,
  );

  const hasPrevious =
    previousUrl.length > 0 ||
    previousSummaries.length > 0 ||
    previousRuns.length > 0 ||
    previousReviews.length > 0;

  return (
    <section className="border-b border-zinc-200/80 pb-6">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <FileMeta label="URL candidates" file={urlCandidates[0]} />
        <FileMeta label="Extraction summary" file={activeSummary} />
        <FileMeta label="Review queue" file={activeReview} />
        <FileMeta label="JSONL run" file={activeRun} />
      </div>

      {hasPrevious ? (
        <details className="mt-5 group">
          <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-700">
            Previous files
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {previousUrl.length > 0 ? (
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  URL candidates
                </div>
                <PreviousFileList files={previousUrl} />
              </div>
            ) : null}
            {previousSummaries.length > 0 ? (
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  Summaries
                </div>
                <PreviousFileList files={previousSummaries} />
              </div>
            ) : null}
            {previousReviews.length > 0 ? (
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  Review queues
                </div>
                <PreviousFileList files={previousReviews} />
              </div>
            ) : null}
            {previousRuns.length > 0 ? (
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                  JSONL runs
                </div>
                <PreviousFileList files={previousRuns} />
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </section>
  );
}
