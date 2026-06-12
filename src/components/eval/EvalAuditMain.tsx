"use client";

import { BrandAuditGallery } from "./BrandAuditGallery";
import { ReviewQueueTable } from "./ReviewQueueTable";
import type { EvalViewerDataKind } from "./BrandAuditViewer";
import type { EvalViewMode } from "./EvalViewToggle";
import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";

type Props = {
  view: EvalViewMode;
  rows: BrandAuditRow[];
  reviewFilename?: string;
  emptyMessage?: string;
  dataKind?: EvalViewerDataKind;
};

export function EvalAuditMain({
  view,
  rows,
  reviewFilename,
  emptyMessage,
  dataKind = "local",
}: Props) {
  const omitPartnerFields = dataKind !== "local";

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
