"use client";

import { Fragment, useMemo, useState } from "react";
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
import { matchesSearchQuery } from "@/lib/evalLocal/evalRowSearch";
import { matchesFieldFilters } from "@/lib/evalLocal/fieldCoverageHelpers";
import { evalTableColumnHeaderLabel } from "@/lib/evalLocal/evalTableColumns";
import { excerptText } from "@/lib/evalLocal/textExcerpt";
import type { UrlCandidateRow } from "@/lib/evalLocal/urlCandidateTypes";
import type { UrlInventoryRow } from "@/lib/evalLocal/urlInventoryJoin";

const PAGE_SIZE = 200;

function searchHaystackForRow(row: UrlInventoryRow): string {
  const candidate = row.candidate;
  const review = row.review;
  return [
    candidate.domain,
    candidate.canonical_domain,
    candidate.normalized_url,
    candidate.project_title,
    candidate.project_type,
    candidate.ds_number,
    candidate.shop_code,
    review?.extracted_business_name,
  ]
    .map((v) => (v ?? "").toLowerCase())
    .join(" ");
}

function formatResultCount(visibleCount: number, filteredCount: number): string {
  return `Showing ${visibleCount.toLocaleString()} of ${filteredCount.toLocaleString()} URLs`;
}

function CandidateExpandedDetails({ candidate }: { candidate: UrlCandidateRow }) {
  const descExcerpt = excerptText(candidate.first_req_description ?? "");
  const noteExcerpt = excerptText(candidate.first_req_note ?? "");

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
          Historical context
        </h4>
        <dl className="mt-2 space-y-2 text-sm text-zinc-800">
          <EvalDetailField label="ds number" value={candidate.ds_number} />
          <EvalDetailField label="project title" value={candidate.project_title} />
          <EvalDetailField label="project type" value={candidate.project_type} />
          <EvalDetailField label="shop code" value={candidate.shop_code} />
          <EvalDetailField label="source column" value={candidate.source_column} />
          <EvalDetailField label="normalized url" value={candidate.normalized_url} mono />
          <EvalDetailField label="domain" value={candidate.domain} />
          <EvalDetailField label="canonical domain" value={candidate.canonical_domain} />
          {descExcerpt ? (
            <EvalDetailField label="first req description" value={descExcerpt} />
          ) : null}
          {noteExcerpt ? (
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
};

export function UrlInventoryTable({ filename, rows }: Props) {
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

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.extractionStatus !== statusFilter) {
        return false;
      }
      if (!matchesSearchQuery(searchHaystackForRow(row), search)) {
        return false;
      }
      if (
        !matchesFieldFilters(row.review, fieldFilters, {
          extractionStatus: row.extractionStatus,
        })
      ) {
        return false;
      }
      return true;
    });
  }, [rows, statusFilter, search, fieldFilters]);

  const successfulInFiltered = filtered.filter(
    (r) => r.extractionStatus === "success",
  ).length;

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;
  const colSpan = visibleColumns.length + 1;

  const processedMatchLine =
    fieldFilters.length > 0 && successfulInFiltered > 0
      ? `${successfulInFiltered.toLocaleString()} successful rows match field filters`
      : undefined;

  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500">
        No URL candidates file loaded. Run npm run eval:urls on a Metabase export.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 space-y-3">
        {filename ? (
          <p className="text-xs text-zinc-500">
            <span className="font-mono text-zinc-600">{filename}</span>
            <span className="text-zinc-400">
              {" "}
              · {rows.length.toLocaleString()} URLs in inventory
            </span>
          </p>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <EvalFilterControls
              showNotRunStatus
              resultCountLine={formatResultCount(visible.length, filtered.length)}
              processedMatchLine={processedMatchLine}
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
                <Fragment key={i}>
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
                        />
                      </td>
                    ))}
                  </tr>
                  {expanded ? (
                    <tr className="border-b border-zinc-100 bg-zinc-50/40">
                      <td colSpan={colSpan} className="px-1 py-5">
                        {review ? (
                          <ExpandedRowDetails row={review} omitPartnerFields={false} />
                        ) : (
                          <CandidateExpandedDetails candidate={candidate} />
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
          className="mt-4 text-sm text-zinc-500 hover:text-zinc-700"
        >
          Show more ({filtered.length - visibleCount} remaining)
        </button>
      ) : null}

    </div>
  );
}
