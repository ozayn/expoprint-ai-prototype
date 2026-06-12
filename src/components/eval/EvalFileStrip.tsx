import {
  matchingExtractionRun,
  matchingReviewQueue,
} from "@/lib/evalLocal/evalFileMatching";
import type { EvalFileEntry } from "@/lib/evalLocal/listEvalFiles";

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

function FileLine({ label, file }: { label: string; file?: EvalFileEntry }) {
  return (
    <div className="min-w-0">
      <span className="text-zinc-400">{label}</span>
      {file ? (
        <>
          {" "}
          <code
            className="font-mono text-zinc-600"
            title={`${file.name} · ${formatMtime(file.mtimeMs)} · ${formatBytes(file.sizeBytes)}`}
          >
            {file.name}
          </code>
        </>
      ) : (
        <span className="text-zinc-400"> —</span>
      )}
    </div>
  );
}

function FileList({ files }: { files: EvalFileEntry[] }) {
  if (files.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-xs text-zinc-500">
      {files.map((f) => (
        <li key={f.relativePath} className="font-mono text-zinc-600">
          {f.name}
          <span className="ml-2 font-sans text-zinc-400">
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

  const previousSummaries = extractionSummaries.filter(
    (f) => f.name !== activeSummary?.name,
  );
  const previousReviews = reviewQueues.filter(
    (f) => f.name !== activeReview?.name,
  );
  const previousFiles = [
    ...urlCandidates,
    ...previousSummaries,
    ...previousReviews,
    ...extractionRuns.filter((f) => f.name !== activeRun?.name),
  ];

  const hasTechnical = urlCandidates.length > 0 || extractionRuns.length > 0;

  return (
    <section className="mb-10 text-xs text-zinc-500">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-x-10">
        <FileLine label="Review queue" file={activeReview} />
        <FileLine label="Extraction summary" file={activeSummary} />
      </div>

      {hasTechnical ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-zinc-400 hover:text-zinc-600">
            Technical files
          </summary>
          <div className="mt-2 space-y-3 pl-0.5">
            {urlCandidates.length > 0 ? (
              <div>
                <div className="text-[11px] text-zinc-400">URL candidates</div>
                <FileList files={urlCandidates} />
              </div>
            ) : null}
            {extractionRuns.length > 0 ? (
              <div>
                <div className="text-[11px] text-zinc-400">JSONL runs</div>
                <FileList files={extractionRuns} />
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      {previousFiles.length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-zinc-400 hover:text-zinc-600">
            Previous files
          </summary>
          <div className="mt-2 pl-0.5">
            <FileList files={previousFiles} />
          </div>
        </details>
      ) : null}
    </section>
  );
}
