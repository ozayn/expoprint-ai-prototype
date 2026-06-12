"use client";

import Link from "next/link";
import { EvalFileStrip } from "./EvalFileStrip";
import { ExtractionSummaryTable } from "./ExtractionSummaryTable";
import { ScoreSummaryPanel } from "./ScoreSummaryPanel";
import type { LocalEvalFileIndex } from "@/lib/evalLocal/listEvalFiles";
import type { ExtractionSummaryRow } from "@/lib/evalLocal/extractionSummaryTypes";
import { buildEvalViewerHref, patchEvalViewerQuery } from "@/lib/evalLocal/evalViewerQuery";
import type { ParsedScoreSummary } from "@/lib/evalLocal/scoreSummaryTypes";
import type { EvalViewerSearchParams } from "./BrandAuditViewer";

function filePillClass(active: boolean): string {
  return [
    "rounded-sm px-1.5 py-0.5 font-mono text-xs transition-colors",
    "outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300",
    active
      ? "text-zinc-900 underline decoration-zinc-300 underline-offset-4"
      : "text-zinc-500 hover:text-zinc-700",
  ].join(" ");
}

function formatUrlCandidatesPillLabel(name: string, rowCount?: number): string {
  const short = name.replace(/^url_candidates_/, "").replace(/\.csv$/, "");
  if (rowCount !== undefined) {
    return `${short} (${rowCount.toLocaleString()})`;
  }
  return short;
}

type Props = {
  basePath: string;
  index: LocalEvalFileIndex;
  summaryName?: string;
  reviewName?: string;
  scoreName?: string;
  urlCandidatesName?: string;
  summaryData: { filename: string; rows: ExtractionSummaryRow[] } | null;
  scoreData: ParsedScoreSummary | null;
  searchParams: EvalViewerSearchParams;
  showCliHints?: boolean;
};

export function EvalInternalsPanel({
  basePath,
  index,
  summaryName,
  reviewName,
  scoreName,
  urlCandidatesName,
  summaryData,
  scoreData,
  searchParams,
  showCliHints = true,
}: Props) {
  return (
    <details className="mt-14 border-t border-zinc-200/60 pt-6">
      <summary className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-700">
        Evaluation internals
      </summary>

      <div className="mt-6 space-y-10">
        <EvalFileStrip
          urlCandidates={index.urlCandidates}
          extractionSummaries={index.extractionSummaries}
          reviewQueues={index.reviewQueues}
          extractionRuns={index.extractionRuns}
          activeSummaryName={summaryName}
          activeReviewName={reviewName}
          activeUrlCandidatesName={urlCandidatesName}
        />

        {index.reviewQueues.length > 1 ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
            <span className="text-zinc-400">Review queue</span>
            {index.reviewQueues.map((f) => {
              const active = f.name === reviewName;
              const short = f.name.replace(/^review_queue_/, "").replace(/\.csv$/, "");
              return (
                <Link
                  key={f.name}
                  href={buildEvalViewerHref(
                    basePath,
                    patchEvalViewerQuery(searchParams, { review: f.name }),
                  )}
                  className={filePillClass(active)}
                >
                  {short}
                </Link>
              );
            })}
          </div>
        ) : null}

        {index.urlCandidates.length > 1 ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
            <span className="text-zinc-400">URL inventory</span>
            {index.urlCandidates.map((f) => {
              const active = f.name === urlCandidatesName;
              return (
                <Link
                  key={f.name}
                  href={buildEvalViewerHref(
                    basePath,
                    patchEvalViewerQuery(searchParams, { urls: f.name }),
                  )}
                  className={filePillClass(active)}
                >
                  {formatUrlCandidatesPillLabel(f.name, f.rowCount)}
                </Link>
              );
            })}
          </div>
        ) : null}

        <ScoreSummaryPanel
          basePath={basePath}
          files={index.scoreSummaries}
          activeName={scoreName}
          data={scoreData}
          searchParams={searchParams}
        />

        <section>
          <h3 className="text-sm font-medium text-zinc-800">Extraction summary</h3>
          {index.extractionSummaries.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No extraction summary yet.</p>
          ) : (
            <>
              {index.extractionSummaries.length > 1 ? (
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                  <span className="text-zinc-400">Run</span>
                  {index.extractionSummaries.map((f) => {
                    const active = f.name === summaryName;
                    const short = f.name
                      .replace(/^extraction_summary_/, "")
                      .replace(/\.csv$/, "");
                    return (
                      <Link
                        key={f.name}
                        href={buildEvalViewerHref(
                          basePath,
                          patchEvalViewerQuery(searchParams, { summary: f.name }),
                        )}
                        className={filePillClass(active)}
                      >
                        {short}
                      </Link>
                    );
                  })}
                </div>
              ) : null}

              {summaryData && summaryData.rows.length > 0 ? (
                <div className="mt-6">
                  <ExtractionSummaryTable
                    filename={summaryData.filename}
                    rows={summaryData.rows}
                  />
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-500">
                  Selected summary has no data rows.
                </p>
              )}
            </>
          )}
          {showCliHints && index.extractionSummaries.length === 0 ? (
            <p className="mt-2 font-mono text-xs text-zinc-400">
              npm run eval:extract -- data/eval/results/url_candidates_&lt;timestamp&gt;.csv
              --limit 5
            </p>
          ) : null}
        </section>
      </div>
    </details>
  );
}
