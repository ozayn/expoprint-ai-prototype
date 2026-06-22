"use client";

import {
  normalizeEvalStatus,
} from "@/lib/evalLocal/normalizeEvalStatus";
import {
  formatProcessedLabel,
  type UrlInventoryProcessedMeta,
} from "@/lib/evalLocal/evalProcessedMeta";
import type { UrlInventoryExtractionStatus } from "@/lib/evalLocal/urlInventoryJoin";

export type EvalExtractionStatusCategory = UrlInventoryExtractionStatus;

/** Map review row status to success / failed / not_run for filters and display. */
export function reviewRowStatusCategory(
  status: string,
): EvalExtractionStatusCategory {
  return normalizeEvalStatus({ status });
}

function StatusCategoryPill({ category }: { category: EvalExtractionStatusCategory }) {
  if (category === "not_run") {
    return (
      <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium leading-tight text-zinc-500">
        Not run
      </span>
    );
  }
  if (category === "success") {
    return (
      <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium leading-tight text-emerald-700">
        Success
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium leading-tight text-red-700">
      Failed
    </span>
  );
}

function ProcessedMetaSecondary({
  processedMeta,
}: {
  processedMeta: UrlInventoryProcessedMeta;
}) {
  const label = formatProcessedLabel(
    processedMeta.processedAt,
    processedMeta.isLatestBatch,
  );
  if (!label) return null;

  return (
    <span
      className="inline-block rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-zinc-500"
      title={
        processedMeta.sourceReviewQueue
          ? `Source: ${processedMeta.sourceReviewQueue}`
          : undefined
      }
    >
      {label}
    </span>
  );
}

export function EvalTableStatusCell({
  category,
  processedMeta,
}: {
  category: EvalExtractionStatusCategory;
  processedMeta?: UrlInventoryProcessedMeta | null;
}) {
  const showMeta =
    category !== "not_run" &&
    processedMeta &&
    (processedMeta.processedAt || processedMeta.isLatestBatch);

  return (
    <div className="flex flex-col items-start gap-0.5">
      <StatusCategoryPill category={category} />
      {showMeta ? <ProcessedMetaSecondary processedMeta={processedMeta} /> : null}
    </div>
  );
}
