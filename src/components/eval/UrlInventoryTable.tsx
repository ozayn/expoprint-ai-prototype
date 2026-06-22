"use client";

import { Fragment, useMemo, useState } from "react";
import { DuplicateUrlVariantsDetail } from "./DuplicateUrlVariantsDetail";
import { EvalDetailField } from "./EvalViewerField";
import { EvalColumnPicker } from "./EvalColumnPicker";
import { useOrderedVisibleEvalColumns } from "./EvalColumnVisibilityContext";
import { EvalTableColGroup } from "./EvalTableColGroup";
import { EvalInventoryTableColumnCell } from "./EvalInventoryTableCells";
import {
  EVAL_AUDIT_TABLE_CLASS,
  EVAL_AUDIT_TABLE_SCROLL_CLASS,
  evalAuditTableMinWidthPx,
  evalTableCellClass,
  evalTableExpandCellClass,
  evalTableExpandHeaderClass,
  evalTableHeaderClass,
} from "./evalTableLayout";
import { EvalFilterControls } from "./EvalFilterControls";
import { useEvalViewerFilters } from "./EvalViewerFilterContext";
import { ExpandedRowDetails } from "./ReviewQueueTable";
import { UrlInventoryToolbar } from "./UrlInventoryToolbar";
import {
  countInventoryRowsByStatus,
  filterUrlInventoryRows,
  normalizedStatusFromInventoryRow,
} from "@/lib/evalLocal/evalRowFilters";
import type { EvalViewerQueryParams } from "@/lib/evalLocal/evalViewerQuery";
import { showUrlInventoryVariants } from "@/lib/evalLocal/evalViewerQuery";
import { evalTableColumnHeaderLabel } from "@/lib/evalLocal/evalTableColumns";
import { excerptText } from "@/lib/evalLocal/textExcerpt";
import {
  classifyUrlPathType,
  URL_PATH_TYPE_LABELS,
  urlForCandidateFields,
} from "@/lib/evalLocal/evalUrlPriority";
import type { UrlCandidateRow } from "@/lib/evalLocal/urlCandidateTypes";
import type { UrlInventoryRow } from "@/lib/evalLocal/urlInventoryJoin";
import { dedupeUrlInventoryRows } from "@/lib/evalLocal/urlInventoryJoin";
import {
  filterUrlInventoryByPathType,
  filterUrlInventoryQuick,
  parseUrlInventoryPathTypeFilter,
  parseUrlInventoryQuickFilter,
  parseUrlInventorySortMode,
  sortUrlInventoryRows,
} from "@/lib/evalLocal/urlInventorySort";

const PAGE_SIZE = 200;

function formatResultCount(visibleCount: number, filteredCount: number): string {
  return `Showing ${visibleCount.toLocaleString()} of ${filteredCount.toLocaleString()} URLs`;
}

function CandidateExpandedDetails({
  candidate,
  duplicateVariants = [],
  omitPartnerFields = false,
}: {
  candidate: UrlCandidateRow;
  duplicateVariants?: import("@/lib/evalLocal/evalCanonicalDedup").DuplicateUrlVariant[];
  omitPartnerFields?: boolean;
}) {
  const descExcerpt = excerptText(candidate.first_req_description ?? "");
  const noteExcerpt = excerptText(candidate.first_req_note ?? "");

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
          {omitPartnerFields ? "URL context" : "Historical context"}
        </h4>
        <dl className="mt-2 space-y-2 text-sm text-zinc-800">
          {!omitPartnerFields ? (
            <EvalDetailField label="ds number" value={candidate.ds_number} />
          ) : null}
          {candidate.project_title ? (
            <EvalDetailField label="project title" value={candidate.project_title} />
          ) : null}
          {candidate.project_type ? (
            <EvalDetailField label="project type" value={candidate.project_type} />
          ) : null}
          {!omitPartnerFields ? (
            <EvalDetailField label="shop code" value={candidate.shop_code} />
          ) : null}
          {candidate.source_column ? (
            <EvalDetailField label="source column" value={candidate.source_column} />
          ) : null}
          <EvalDetailField
            label="url type"
            value={
              URL_PATH_TYPE_LABELS[
                classifyUrlPathType(
                  urlForCandidateFields(
                    candidate.normalized_url,
                    candidate.raw_url,
                  ),
                )
              ]
            }
          />
          {candidate.normalized_url ? (
            <EvalDetailField label="normalized url" value={candidate.normalized_url} mono />
          ) : null}
          {candidate.domain ? (
            <EvalDetailField label="domain" value={candidate.domain} />
          ) : null}
          {candidate.canonical_domain ? (
            <EvalDetailField label="canonical domain" value={candidate.canonical_domain} />
          ) : null}
          <DuplicateUrlVariantsDetail
            variants={duplicateVariants}
            label="Duplicate source URLs"
          />
          {!omitPartnerFields && descExcerpt ? (
            <EvalDetailField label="first req description" value={descExcerpt} />
          ) : null}
          {!omitPartnerFields && noteExcerpt ? (
            <EvalDetailField label="first req note" value={noteExcerpt} />
          ) : null}
        </dl>
      </div>
      <p className="text-sm text-zinc-500">
        Extraction has not been run for this URL candidate yet.
      </p>
    </div>
  );
}

type Props = {
  filename?: string;
  rows: UrlInventoryRow[];
  rawRows?: UrlInventoryRow[];
  omitPartnerFields?: boolean;
  basePath?: string;
  searchParams?: EvalViewerQueryParams;
};

export function UrlInventoryTable({
  filename,
  rows: inputRows,
  rawRows,
  omitPartnerFields = false,
  basePath = "/internal/eval",
  searchParams = {},
}: Props) {
  const showVariants = showUrlInventoryVariants(searchParams);
  const rows = useMemo(() => {
    if (showVariants) {
      return rawRows ?? inputRows;
    }
    return dedupeUrlInventoryRows(inputRows).rows;
  }, [inputRows, rawRows, showVariants]);

  const sortMode = parseUrlInventorySortMode(searchParams.sort ?? "recent");
  const quickFilter = parseUrlInventoryQuickFilter(searchParams.inventory);
  const pathTypeFilter = parseUrlInventoryPathTypeFilter(searchParams.urlType);

  const {
    search,
    statusFilter,
    fieldFilters,
    paginationKey,
  } = useEvalViewerFilters();

  const visibleColumns = useOrderedVisibleEvalColumns();

  const [visibleLimit, setVisibleLimit] = useState({
    paginationKey,
    count: PAGE_SIZE,
  });
  const [expandedRow, setExpandedRow] = useState<{
    paginationKey: number;
    index: number;
  } | null>(null);

  const visibleCount =
    visibleLimit.paginationKey === paginationKey ? visibleLimit.count : PAGE_SIZE;
  const expandedIndex =
    expandedRow?.paginationKey === paginationKey ? expandedRow.index : null;

  const statusCounts = useMemo(
    () => countInventoryRowsByStatus(rows),
    [rows],
  );

  const filtered = useMemo(() => {
    const quickFiltered = filterUrlInventoryQuick(rows, quickFilter);
    const pathFiltered = filterUrlInventoryByPathType(
      quickFiltered,
      pathTypeFilter,
    );
    return filterUrlInventoryRows(pathFiltered, {
      search,
      statusFilter,
      fieldFilters,
    }, { omitPartnerFields });
  }, [
    rows,
    quickFilter,
    pathTypeFilter,
    search,
    statusFilter,
    fieldFilters,
    omitPartnerFields,
  ]);

  const sorted = useMemo(
    () => sortUrlInventoryRows(filtered, sortMode),
    [filtered, sortMode],
  );

  const successfulInFiltered = sorted.filter(
    (r) => normalizedStatusFromInventoryRow(r) === "success",
  ).length;

  const visible = sorted.slice(0, visibleCount);
  const hasMore = sorted.length > visibleCount;
  const colSpan = visibleColumns.length + 1;

  const processedMatchLine =
    fieldFilters.length > 0 && successfulInFiltered > 0
      ? `${successfulInFiltered.toLocaleString()} successful rows match field filters (field filters apply to processed rows with extraction data)`
      : fieldFilters.length > 0
        ? "Field filters apply to processed rows with extraction data"
        : undefined;

  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500">
        {omitPartnerFields
          ? "No published URL inventory in this dataset."
          : "No URL candidates file loaded. Run npm run eval:urls on a Metabase export."}
      </p>
    );
  }

  return (
    <div suppressHydrationWarning>
      <div className="mb-4 space-y-3" suppressHydrationWarning>
        {filename ? (
          <p className="text-xs text-zinc-500">
            <span className="font-mono text-zinc-600">{filename}</span>
            <span className="text-zinc-400">
              {" "}
              · {rows.length.toLocaleString()} URLs in inventory
            </span>
          </p>
        ) : null}
        <UrlInventoryToolbar basePath={basePath} searchParams={searchParams} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <EvalFilterControls
              showNotRunStatus
              resultCountLine={formatResultCount(sorted.length, rows.length)}
              processedMatchLine={processedMatchLine}
              statusCounts={statusCounts}
            />
          </div>
          <EvalColumnPicker />
        </div>
      </div>

      <div className={EVAL_AUDIT_TABLE_SCROLL_CLASS}>
        <table
          className={EVAL_AUDIT_TABLE_CLASS}
          style={{ minWidth: evalAuditTableMinWidthPx(visibleColumns) }}
        >
          <EvalTableColGroup columns={visibleColumns} />
          <thead>
            <tr className="border-b border-zinc-200 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              <th className={evalTableExpandHeaderClass()} aria-label="Expand" />
              {visibleColumns.map((columnId) => (
                <th key={columnId} className={evalTableHeaderClass()}>
                  {evalTableColumnHeaderLabel(columnId)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => {
              const expanded = expandedIndex === i;
              const candidate = row.candidate;
              const review = row.review;
              return (
                <Fragment key={`${row.originalIndex}-${i}`}>
                  <tr
                    className={`cursor-pointer border-b border-zinc-100 align-top transition-colors hover:bg-zinc-50/80 ${
                      expanded ? "bg-zinc-50/60" : ""
                    }`}
                    onClick={() =>
                      setExpandedRow(
                        expandedIndex === i ? null : { paginationKey, index: i },
                      )
                    }
                    aria-expanded={expanded}
                  >
                    <td className={evalTableExpandCellClass()}>
                      {expanded ? "▾" : "▸"}
                    </td>
                    {visibleColumns.map((columnId) => (
                      <td key={columnId} className={evalTableCellClass()}>
                        <EvalInventoryTableColumnCell
                          columnId={columnId}
                          candidate={candidate}
                          review={review}
                          extractionStatus={row.extractionStatus}
                          processedMeta={row.processedMeta}
                          omitPartnerFields={omitPartnerFields}
                        />
                      </td>
                    ))}
                  </tr>
                  {expanded ? (
                    <tr className="border-b border-zinc-100 bg-zinc-50/40">
                      <td colSpan={colSpan} className="px-1 py-5">
                        {review ? (
                          <ExpandedRowDetails
                            row={review}
                            omitPartnerFields={omitPartnerFields}
                          />
                        ) : (
                          <CandidateExpandedDetails
                            candidate={candidate}
                            duplicateVariants={row.duplicateVariants}
                            omitPartnerFields={omitPartnerFields}
                          />
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasMore ? (
        <button
          type="button"
          onClick={() =>
            setVisibleLimit({
              paginationKey,
              count: visibleCount + PAGE_SIZE,
            })
          }
          suppressHydrationWarning
          className="mt-4 text-sm text-zinc-500 hover:text-zinc-700"
        >
          Show more ({sorted.length - visibleCount} remaining)
        </button>
      ) : null}

    </div>
  );
}
