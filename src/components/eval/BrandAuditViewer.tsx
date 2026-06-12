import type { ReactNode } from "react";
import Link from "next/link";
import { EvalAuditMain } from "./EvalAuditMain";
import { EvalViewToggle, type EvalViewMode } from "./EvalViewToggle";
import {
  computeFieldCoverageSummary,
  formatFieldCoverageSummary,
} from "@/lib/evalLocal/brandExtractionParse";
import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";
import type { InternalEvalDataSource } from "@/lib/evalLocal/publishedInternalEvalTypes";

export type EvalViewerSearchParams = {
  summary?: string;
  review?: string;
  score?: string;
  view?: string;
};

export function parseEvalViewMode(view: string | undefined): EvalViewMode {
  return view === "table" ? "table" : "gallery";
}

export type EvalViewerDataKind = "local" | InternalEvalDataSource;

export type BrandAuditViewerProps = {
  title?: string;
  subtitle: string;
  safetyNote?: string;
  deployedNote?: string;
  dataSourceLabel?: string;
  publishedAt?: string;
  sourceReviewQueue?: string;
  publishHint?: string;
  dataKind?: EvalViewerDataKind;
  headerAction?: ReactNode;
  prependContent?: ReactNode;
  basePath?: string;
  searchParams?: EvalViewerSearchParams;
  reviewFilename?: string;
  rows: BrandAuditRow[];
  emptyMessage?: string;
  children?: ReactNode;
};

export function BrandAuditViewer({
  title = "Historical brand audit",
  subtitle,
  safetyNote,
  deployedNote,
  dataSourceLabel,
  publishedAt,
  sourceReviewQueue,
  publishHint,
  dataKind = "local",
  headerAction,
  prependContent,
  basePath = "/internal/eval",
  searchParams = {},
  reviewFilename,
  rows,
  emptyMessage,
  children,
}: BrandAuditViewerProps) {
  const view = parseEvalViewMode(searchParams.view);
  const coverageLine =
    rows.length > 0
      ? formatFieldCoverageSummary(computeFieldCoverageSummary(rows))
      : null;

  return (
    <div className="min-h-full bg-zinc-50/30 text-zinc-900">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
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

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
                  {title}
                </h1>
                <EvalViewToggle
                  basePath={basePath}
                  searchParams={searchParams}
                  view={view}
                />
              </div>
              <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
              {dataSourceLabel ? (
                <p className="mt-2 text-[11px] font-medium text-zinc-500">
                  {dataSourceLabel}
                </p>
              ) : null}
              {reviewFilename ? (
                <p className="mt-1 text-[11px] text-zinc-400">
                  <span className="font-mono">{reviewFilename}</span>
                </p>
              ) : null}
              {sourceReviewQueue ? (
                <p className="mt-1 text-[11px] text-zinc-400">
                  Published from{" "}
                  <span className="font-mono">{sourceReviewQueue}</span>
                </p>
              ) : null}
              {publishedAt ? (
                <p className="mt-1 text-[11px] text-zinc-400">
                  Generated at{" "}
                  <time dateTime={publishedAt}>
                    {new Date(publishedAt).toLocaleString()}
                  </time>
                </p>
              ) : null}
              {publishHint ? (
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                  To publish this dataset to /internal/eval, run:
                  <span className="mt-1 block font-mono text-[10px] text-zinc-400">
                    {publishHint}
                  </span>
                </p>
              ) : null}
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              {headerAction}
              {safetyNote ? (
                <p className="text-[11px] text-zinc-400">{safetyNote}</p>
              ) : null}
            </div>
          </div>

          {deployedNote ? (
            <p className="mt-6 text-xs leading-relaxed text-zinc-500">{deployedNote}</p>
          ) : null}
        </header>

        {coverageLine ? (
          <p className="mb-6 text-sm text-zinc-600">{coverageLine}</p>
        ) : null}

        {prependContent ? (
          <div className="mb-6">{prependContent}</div>
        ) : null}

        <EvalAuditMain
          view={view}
          rows={rows}
          reviewFilename={reviewFilename}
          emptyMessage={emptyMessage}
          dataKind={dataKind}
        />

        {children}
      </div>
    </div>
  );
}
