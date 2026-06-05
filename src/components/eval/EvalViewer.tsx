import Link from "next/link";
import { EvalFileStrip } from "./EvalFileStrip";
import { ExtractionSummaryTable } from "./ExtractionSummaryTable";
import { ReviewQueueTable } from "./ReviewQueueTable";
import { ScoreSummaryPanel } from "./ScoreSummaryPanel";
import type { LocalEvalFileIndex } from "@/lib/evalLocal/listEvalFiles";
import type { ExtractionSummaryRow } from "@/lib/evalLocal/extractionSummaryTypes";
import type { ReviewQueueRow } from "@/lib/evalLocal/reviewQueueTypes";
import type { ParsedScoreSummary } from "@/lib/evalLocal/scoreSummaryTypes";

export type EvalViewerSearchParams = {
  summary?: string;
  review?: string;
  score?: string;
};

export type EvalViewerProps = {
  basePath: string;
  subtitle: string;
  safetyNote: string;
  index: LocalEvalFileIndex;
  summaryName?: string;
  reviewName?: string;
  scoreName?: string;
  summaryData: { filename: string; rows: ExtractionSummaryRow[] } | null;
  reviewData: { filename: string; rows: ReviewQueueRow[] } | null;
  scoreData: ParsedScoreSummary | null;
  searchParams: EvalViewerSearchParams;
  showCliHints?: boolean;
};

function buildEvalHref(
  basePath: string,
  current: EvalViewerSearchParams,
  key: "summary" | "review",
  value: string,
): string {
  const next = { ...current, [key]: value };
  const q = new URLSearchParams();
  if (next.summary) q.set("summary", next.summary);
  if (next.review) q.set("review", next.review);
  if (next.score) q.set("score", next.score);
  const qs = q.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function filePillClass(active: boolean): string {
  return [
    "rounded-sm px-1.5 py-0.5 font-mono text-xs transition-colors",
    "outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300",
    active
      ? "text-zinc-900 underline decoration-zinc-300 underline-offset-4"
      : "text-zinc-500 hover:text-zinc-700",
  ].join(" ");
}

function FilePicker({
  basePath,
  param,
  files,
  activeName,
  label,
  currentParams,
}: {
  basePath: string;
  param: "summary" | "review";
  files: { name: string }[];
  activeName?: string;
  label: string;
  currentParams: EvalViewerSearchParams;
}) {
  if (files.length <= 1) return null;

  const stripPrefix =
    param === "summary"
      ? /^extraction_summary_/
      : /^review_queue_|^review_queue\./;
  const stripSuffix = /\.csv$/;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
      <span className="text-zinc-400">{label}</span>
      {files.map((f) => {
        const active = f.name === activeName;
        const href = buildEvalHref(basePath, currentParams, param, f.name);
        const shortName = f.name
          .replace(stripPrefix, "")
          .replace(stripSuffix, "")
          .replace(/\.example$/, "");
        return (
          <Link
            key={f.name}
            href={href}
            className={filePillClass(active)}
          >
            {shortName || f.name}
          </Link>
        );
      })}
    </div>
  );
}

function SectionIntro({ title, description }: { title: string; description: string }) {
  return (
    <>
      <h2 className="text-sm font-medium text-zinc-900">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
    </>
  );
}

function EmptySummaryState() {
  return (
    <p className="py-6 text-sm text-zinc-500">No extraction summary yet.</p>
  );
}

function EmptyReviewState({ showCliHints }: { showCliHints: boolean }) {
  return (
    <div className="py-8">
      <p className="text-sm text-zinc-500">No review queue yet.</p>
      {showCliHints ? (
        <p className="mt-2 font-mono text-xs leading-relaxed text-zinc-400">
          npm run eval:review -- data/eval/runs/extraction_run_&lt;timestamp&gt;.jsonl
        </p>
      ) : null}
    </div>
  );
}

export function EvalViewer({
  basePath,
  subtitle,
  safetyNote,
  index,
  summaryName,
  reviewName,
  scoreName,
  summaryData,
  reviewData,
  scoreData,
  searchParams,
  showCliHints = true,
}: EvalViewerProps) {
  return (
    <div className="min-h-full bg-white text-zinc-900">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8">
          <nav className="text-sm text-zinc-500">
            <Link href="/" className="hover:text-zinc-800">
              Back to editor
            </Link>
            <span className="mx-2 text-zinc-300">/</span>
            <Link href="/progress" className="hover:text-zinc-800">
              Progress
            </Link>
          </nav>

          <div className="mt-5 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
                Historical evaluation
              </h1>
              <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
            </div>
            <p className="text-[11px] text-zinc-400">{safetyNote}</p>
          </div>
        </header>

        <EvalFileStrip
          urlCandidates={index.urlCandidates}
          extractionSummaries={index.extractionSummaries}
          reviewQueues={index.reviewQueues}
          extractionRuns={index.extractionRuns}
          activeSummaryName={summaryName}
          activeReviewName={reviewName}
        />

        <section className="mb-12">
          <SectionIntro
            title="Comparison rows for manual scoring"
            description="Historical project data beside ExpoPrint output. Fill scores in the review_queue CSV."
          />

          {index.reviewQueues.length === 0 ? (
            <EmptyReviewState showCliHints={showCliHints} />
          ) : (
            <>
              <FilePicker
                basePath={basePath}
                param="review"
                files={index.reviewQueues}
                activeName={reviewName}
                label="Queue"
                currentParams={searchParams}
              />

              {reviewData && reviewData.rows.length > 0 ? (
                <ReviewQueueTable
                  filename={reviewData.filename}
                  rows={reviewData.rows}
                />
              ) : (
                <p className="mt-4 text-sm text-zinc-500">
                  Selected review queue has no data rows.
                </p>
              )}
            </>
          )}
        </section>

        <ScoreSummaryPanel
          basePath={basePath}
          files={index.scoreSummaries}
          activeName={scoreName}
          data={scoreData}
          searchParams={searchParams}
        />

        <section className="mt-14">
          <details className="group">
            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <div className="flex items-start justify-between gap-4">
                <SectionIntro
                  title="Websites processed by ExpoPrint"
                  description="Historical URLs that were run through the extraction pipeline."
                />
                <span className="shrink-0 pt-0.5 text-[11px] text-zinc-400 group-open:hidden">
                  Show
                </span>
                <span className="hidden shrink-0 pt-0.5 text-[11px] text-zinc-400 group-open:inline">
                  Hide
                </span>
              </div>
            </summary>

            <div className="mt-6">
              {index.extractionSummaries.length === 0 ? (
                <EmptySummaryState />
              ) : (
                <>
                  <FilePicker
                    basePath={basePath}
                    param="summary"
                    files={index.extractionSummaries}
                    activeName={summaryName}
                    label="Run"
                    currentParams={searchParams}
                  />

                  {summaryData && summaryData.rows.length > 0 ? (
                    <ExtractionSummaryTable
                      filename={summaryData.filename}
                      rows={summaryData.rows}
                    />
                  ) : (
                    <p className="text-sm text-zinc-500">
                      Selected summary has no data rows.
                    </p>
                  )}
                </>
              )}
            </div>
          </details>
        </section>
      </div>
    </div>
  );
}
