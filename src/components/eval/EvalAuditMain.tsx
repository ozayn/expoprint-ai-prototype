"use client";

import { BrandAuditGallery } from "./BrandAuditGallery";
import { ReviewQueueTable } from "./ReviewQueueTable";
import { UrlInventoryTable } from "./UrlInventoryTable";
import type { EvalViewMode } from "./EvalViewToggle";
import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";
import type { EvalViewerQueryParams } from "@/lib/evalLocal/evalViewerQuery";
import type { UrlInventoryRow } from "@/lib/evalLocal/urlInventoryJoin";

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
      <BrandAuditGallery
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
