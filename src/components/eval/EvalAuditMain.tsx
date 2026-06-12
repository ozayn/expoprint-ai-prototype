"use client";

import { BrandAuditGallery } from "./BrandAuditGallery";
import { ReviewQueueTable } from "./ReviewQueueTable";
import type { EvalViewMode } from "./EvalViewToggle";
import type { ReviewQueueRow } from "@/lib/evalLocal/reviewQueueTypes";

type Props = {
  view: EvalViewMode;
  rows: ReviewQueueRow[];
  reviewFilename?: string;
  emptyMessage?: string;
};

export function EvalAuditMain({
  view,
  rows,
  reviewFilename,
  emptyMessage,
}: Props) {
  if (view === "gallery") {
    return <BrandAuditGallery rows={rows} emptyMessage={emptyMessage} />;
  }
  return <ReviewQueueTable filename={reviewFilename ?? ""} rows={rows} />;
}
