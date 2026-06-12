import type { ReactNode } from "react";
import Link from "next/link";
import { EvalAuditMain } from "./EvalAuditMain";
import { EvalViewToggle, type EvalViewMode } from "./EvalViewToggle";
import {
  computeFieldCoverageSummary,
  formatFieldCoverageSummary,
} from "@/lib/evalLocal/brandExtractionParse";
import type { ReviewQueueRow } from "@/lib/evalLocal/reviewQueueTypes";

export type EvalViewerSearchParams = {
  summary?: string;
  review?: string;
  score?: string;
  view?: string;
};

export function parseEvalViewMode(view: string | undefined): EvalViewMode {
  return view === "table" ? "table" : "gallery";
}

export type BrandAuditViewerProps = {
  title?: string;
  subtitle: string;
  safetyNote?: string;
  deployedNote?: string;
  headerAction?: ReactNode;
  basePath?: string;
  searchParams?: EvalViewerSearchParams;
  reviewFilename?: string;
  rows: ReviewQueueRow[];
  emptyMessage?: string;
  children?: ReactNode;
};

export function BrandAuditViewer({
  title = "Historical brand audit",
  subtitle,
  safetyNote,
  deployedNote,
  headerAction,
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
              {reviewFilename ? (
                <p className="mt-2 text-[11px] text-zinc-400">
                  <span className="font-mono">{reviewFilename}</span>
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

        <EvalAuditMain
          view={view}
          rows={rows}
          reviewFilename={reviewFilename}
          emptyMessage={emptyMessage}
        />

        {children}
      </div>
    </div>
  );
}
