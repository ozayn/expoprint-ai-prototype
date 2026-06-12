"use client";

import { BrandAuditGallery } from "./BrandAuditGallery";
import { ReviewQueueTable } from "./ReviewQueueTable";
import type { EvalViewerDataKind } from "./BrandAuditViewer";
import type { EvalViewMode } from "./EvalViewToggle";
import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";
import type { UrlInventoryRow } from "@/lib/evalLocal/urlInventoryJoin";
import { UrlInventoryTable } from "./UrlInventoryTable";

type Props = {
  view: EvalViewMode;
  rows: BrandAuditRow[];
  reviewFilename?: string;
  emptyMessage?: string;
  dataKind?: EvalViewerDataKind;
  urlInventoryFilename?: string;
  urlInventoryRows?: UrlInventoryRow[];
  omitPartnerFields?: boolean;
};

export function EvalAuditMain({
  view,
  rows,
  reviewFilename,
  emptyMessage,
  dataKind = "local",
  urlInventoryFilename,
  urlInventoryRows,
  omitPartnerFields: omitPartnerFieldsProp,
}: Props) {
  const omitPartnerFields = omitPartnerFieldsProp ?? dataKind !== "local";

  if (view === "inventory") {
    return (
      <UrlInventoryTable
        filename={urlInventoryFilename}
        rows={urlInventoryRows ?? []}
        omitPartnerFields={omitPartnerFields}
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
