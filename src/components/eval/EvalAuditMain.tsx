"use client";

import { BrandAuditGallery } from "./BrandAuditGallery";
import { ReviewQueueTable } from "./ReviewQueueTable";
import { UrlInventoryTable } from "./UrlInventoryTable";
import { EvalFilterControls } from "./EvalFilterControls";
import { useOptionalEvalViewerFilters } from "./EvalViewerFilterContext";
import type { EvalViewMode } from "./EvalViewToggle";
import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";
import type { EvalViewerQueryParams } from "@/lib/evalLocal/evalViewerQuery";
import {
  countBrandAuditRowsByStatus,
  filterBrandAuditRows,
  normalizedStatusFromReviewRow,
} from "@/lib/evalLocal/evalRowFilters";
import type { UrlInventoryRow } from "@/lib/evalLocal/urlInventoryJoin";
import { useMemo } from "react";

type Props = {
  view: EvalViewMode;
  rows: BrandAuditRow[];
  reviewFilename?: string;
  emptyMessage?: string;
  urlInventoryFilename?: string;
  urlInventoryRows?: UrlInventoryRow[];
  urlInventoryRawRows?: UrlInventoryRow[];
  omitPartnerFields?: boolean;
  basePath?: string;
  searchParams?: EvalViewerQueryParams;
};

function FilteredGallery({
  rows,
  emptyMessage,
  omitPartnerFields,
}: {
  rows: BrandAuditRow[];
  emptyMessage?: string;
  omitPartnerFields?: boolean;
}) {
  const filterCtx = useOptionalEvalViewerFilters();
  const statusCounts = useMemo(() => countBrandAuditRowsByStatus(rows), [rows]);

  const filtered = useMemo(() => {
    if (!filterCtx) return rows;
    return filterBrandAuditRows(rows, {
      search: filterCtx.search,
      statusFilter: filterCtx.statusFilter,
      fieldFilters: filterCtx.fieldFilters,
    });
  }, [rows, filterCtx]);

  const successfulInFiltered = filtered.filter(
    (r) => normalizedStatusFromReviewRow(r) === "success",
  ).length;

  const processedMatchLine =
    filterCtx &&
    filterCtx.fieldFilters.length > 0 &&
    successfulInFiltered > 0
      ? `${successfulInFiltered.toLocaleString()} successful rows match field filters (field filters apply to processed rows with extraction data)`
      : filterCtx && filterCtx.fieldFilters.length > 0
        ? "Field filters apply to processed rows with extraction data"
        : undefined;

  return (
    <div>
      {filterCtx ? (
        <div className="mb-4">
          <EvalFilterControls
            showNotRunStatus={false}
            resultCountLine={`Showing ${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} rows`}
            processedMatchLine={processedMatchLine}
            statusCounts={statusCounts}
          />
        </div>
      ) : null}
      <BrandAuditGallery
        rows={filtered}
        emptyMessage={emptyMessage}
        omitPartnerFields={omitPartnerFields}
      />
    </div>
  );
}

export function EvalAuditMain({
  view,
  rows,
  reviewFilename,
  emptyMessage,
  urlInventoryFilename,
  urlInventoryRows,
  urlInventoryRawRows,
  omitPartnerFields: omitPartnerFieldsProp,
  basePath = "/internal/eval",
  searchParams = {},
}: Props) {
  const omitPartnerFields = omitPartnerFieldsProp ?? false;

  if (view === "inventory") {
    return (
      <UrlInventoryTable
        filename={urlInventoryFilename}
        rows={urlInventoryRows ?? []}
        rawRows={urlInventoryRawRows}
        omitPartnerFields={omitPartnerFields}
        basePath={basePath}
        searchParams={searchParams}
      />
    );
  }

  if (view === "gallery") {
    return (
      <FilteredGallery
        rows={rows}
        emptyMessage={emptyMessage}
        omitPartnerFields={omitPartnerFields}
      />
    );
  }
  return (
    <ReviewQueueTable
      filename={reviewFilename ?? ""}
      rows={rows}
      omitPartnerFields={omitPartnerFields}
    />
  );
}
