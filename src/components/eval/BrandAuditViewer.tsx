import type { ReactNode } from "react";
import Link from "next/link";
import { BrandAuditCoverageSummary } from "./BrandAuditCoverageSummary";
import { EvalAuditMain } from "./EvalAuditMain";
import { EvalColumnVisibilityProvider } from "./EvalColumnVisibilityContext";
import { EvalViewerFilterProvider } from "./EvalViewerFilterContext";
import { EvalViewToggle } from "./EvalViewToggle";
import {
  resolveEvalViewMode,
  statusFilterFromQueryParams,
} from "@/lib/evalLocal/evalViewerQuery";
import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";
import { dedupeBrandAuditRows } from "@/lib/evalLocal/evalCanonicalDedup";
import type { InternalEvalDataSource } from "@/lib/evalLocal/publishedInternalEvalTypes";
import type { EvalFileEntry } from "@/lib/evalLocal/listEvalFiles";
import type { EvalViewerQueryParams } from "@/lib/evalLocal/evalViewerQuery";
import { EvalReviewQueuePicker } from "./EvalReviewQueuePicker";
import type {
  UrlInventoryRow,
  UrlInventoryStats,
} from "@/lib/evalLocal/urlInventoryJoin";

export type EvalViewerSearchParams = EvalViewerQueryParams;

export type EvalViewerDataKind = "local" | InternalEvalDataSource;

export type BrandAuditViewerProps = {
  title?: string;
  subtitle: string;
  safetyNote?: string;
  deployedNote?: string;
  dataSourceLabel?: string;
  publishedAt?: string;
  sourceReviewQueue?: string;
  sourceUrlCandidates?: string;
  reviewRowCount?: number;
  urlInventoryRowCount?: number;
  publishHint?: string;
  dataKind?: EvalViewerDataKind;
  headerAction?: ReactNode;
  prependContent?: ReactNode;
  basePath?: string;
  searchParams?: EvalViewerSearchParams;
  reviewFilename?: string;
  rows: BrandAuditRow[];
  urlInventoryFilename?: string;
  urlInventoryRows?: UrlInventoryRow[];
  urlInventoryRawRows?: UrlInventoryRow[];
  inventoryStats?: UrlInventoryStats | null;
  emptyMessage?: string;
  enableFieldFilters?: boolean;
  batchReviewQueues?: EvalFileEntry[];
  combinedReviewQueues?: EvalFileEntry[];
  children?: ReactNode;
};

export function BrandAuditViewer({
  title = "Historical brand audit",
  subtitle,
  dataSourceLabel,
  publishedAt,
  sourceReviewQueue,
  sourceUrlCandidates,
  reviewRowCount,
  urlInventoryRowCount,
  publishHint,
  dataKind = "local",
  headerAction,
  prependContent,
  basePath = "/internal/eval",
  searchParams = {},
  reviewFilename,
  rows,
  urlInventoryFilename,
  urlInventoryRows,
  urlInventoryRawRows,
  inventoryStats,
  emptyMessage,
  enableFieldFilters = true,
  batchReviewQueues = [],
  combinedReviewQueues = [],
  children,
}: BrandAuditViewerProps) {
  const showUrlInventory =
    Boolean(urlInventoryFilename) ||
    Boolean(inventoryStats && inventoryStats.totalRawCandidates > 0);
  const view = resolveEvalViewMode(searchParams.view, showUrlInventory);
  const displayRows = dedupeBrandAuditRows(rows).items;

  const content = (
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
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
                {title}
              </h1>
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
                  Review source{" "}
                  <span className="font-mono">{sourceReviewQueue}</span>
                  {reviewRowCount !== undefined
                    ? ` · ${reviewRowCount.toLocaleString()} rows`
                    : null}
                </p>
              ) : null}
              {sourceUrlCandidates ? (
                <p className="mt-1 text-[11px] text-zinc-400">
                  URL inventory source{" "}
                  <span className="font-mono">{sourceUrlCandidates}</span>
                  {urlInventoryRowCount !== undefined
                    ? ` · ${urlInventoryRowCount.toLocaleString()} URLs`
                    : null}
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
            </div>
          </div>
        </header>

        {prependContent ? (
          <div className="mb-6">{prependContent}</div>
        ) : null}

        <BrandAuditCoverageSummary
          rows={displayRows}
          inventoryStats={inventoryStats}
        />

        {dataKind === "local" &&
        (batchReviewQueues.length > 0 || combinedReviewQueues.length > 0) ? (
          <EvalReviewQueuePicker
            basePath={basePath}
            searchParams={searchParams}
            activeReviewName={reviewFilename}
            batchQueues={batchReviewQueues}
            combinedQueues={combinedReviewQueues}
          />
        ) : null}

        <div className="mb-6 flex items-center justify-end">
          <EvalViewToggle
            basePath={basePath}
            searchParams={searchParams}
            view={view}
            showInventoryTab={showUrlInventory}
          />
        </div>

        <EvalAuditMain
          view={view}
          rows={displayRows}
          reviewFilename={reviewFilename}
          emptyMessage={emptyMessage}
          urlInventoryFilename={urlInventoryFilename}
          urlInventoryRows={urlInventoryRows}
          urlInventoryRawRows={urlInventoryRawRows}
          omitPartnerFields={false}
          basePath={basePath}
          searchParams={searchParams}
        />

        {children}
      </div>
    </div>
  );

  const wrapped = (
    <EvalColumnVisibilityProvider>{content}</EvalColumnVisibilityProvider>
  );

  if (enableFieldFilters) {
    return (
      <EvalViewerFilterProvider
        key={statusFilterFromQueryParams(searchParams)}
        initialStatusFilter={statusFilterFromQueryParams(searchParams)}
        urlSync={{ basePath, searchParams }}
      >
        {wrapped}
      </EvalViewerFilterProvider>
    );
  }
  return wrapped;
}
