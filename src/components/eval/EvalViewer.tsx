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
    <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
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
            className={`rounded px-2 py-1 font-mono transition-colors ${
              active
                ? "bg-zinc-200/80 text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            }`}
          >
            {shortName || f.name}
          </Link>
        );
      })}
    </div>
  );
}

function EmptySummaryState({ showCliHints }: { showCliHints: boolean }) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm text-zinc-500">No extraction summary yet.</p>
      {showCliHints ? (
        <p className="mt-3 font-mono text-xs leading-relaxed text-zinc-400">
          npm run eval:extract -- data/eval/results/url_candidates_&lt;timestamp&gt;.csv
          --limit 5
        </p>
      ) : null}
    </div>
  );
}

function SectionIntro({ title, description }: { title: string; description: string }) {
  return (
    <>
      <h2 className="text-sm font-medium text-zinc-900">{title}</h2>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{description}</p>
    </>
  );
}

function EmptyReviewState({ showCliHints }: { showCliHints: boolean }) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm text-zinc-500">No review queue yet.</p>
      {showCliHints ? (
        <p className="mt-3 font-mono text-xs leading-relaxed text-zinc-400">
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
        <header className="mb-10">
          <nav className="text-sm text-zinc-500">
            <Link href="/" className="hover:text-zinc-800">
              Back to editor
            </Link>
            <span className="mx-2 text-zinc-300">/</span>
            <Link href="/progress" className="hover:text-zinc-800">
              Progress
            </Link>
          </nav>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
                Historical evaluation
              </h1>
              <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
            </div>
            <p className="text-xs text-zinc-400">{safetyNote}</p>
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

        <div className="grid gap-12 pt-2 lg:grid-cols-2 lg:gap-10">
          <section>
            <SectionIntro
              title="Websites processed by ExpoPrint"
              description="Each row is a historical URL from the Metabase export that was run through the ExpoPrint website extraction pipeline. This table shows whether extraction succeeded, how long it took, and the basic extracted output."
            />

            {index.extractionSummaries.length === 0 ? (
              <EmptySummaryState showCliHints={showCliHints} />
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
                  <p className="mt-6 text-sm text-zinc-500">
                    Selected summary has no data rows.
                  </p>
                )}
              </>
            )}
          </section>

          <section>
            <SectionIntro
              title="Comparison rows for manual scoring"
              description="Each row combines historical project/request data with ExpoPrint’s extracted fields. Use this table to review whether the extracted business name, category, logo, and brief are correct enough to use."
            />
            {showCliHints ? (
              <p className="mt-2 text-xs text-zinc-400">
                Scores are blank until filled manually in the review_queue CSV.
              </p>
            ) : null}

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
                  <p className="mt-6 text-sm text-zinc-500">
                    Selected review queue has no data rows.
                  </p>
                )}
              </>
            )}
          </section>
        </div>

        <ScoreSummaryPanel
          basePath={basePath}
          files={index.scoreSummaries}
          activeName={scoreName}
          data={scoreData}
          searchParams={searchParams}
        />
      </div>
    </div>
  );
}
