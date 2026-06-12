"use client";

import { BrandAuditCard } from "./BrandAuditCard";
import type { ReviewQueueRow } from "@/lib/evalLocal/reviewQueueTypes";

type Props = {
  rows: ReviewQueueRow[];
  emptyMessage?: string;
};

export function BrandAuditGallery({ rows, emptyMessage }: Props) {
  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500">
        {emptyMessage ?? "No review rows to display."}
      </p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {rows.map((row, index) => (
        <BrandAuditCard key={`${row.ds_number}-${row.normalized_url}-${index}`} row={row} />
      ))}
    </div>
  );
}
