"use client";

import Link from "next/link";
import type { EvalFileEntry } from "@/lib/evalLocal/listEvalFiles";
import {
  buildEvalViewerHref,
  patchEvalViewerQuery,
  type EvalViewerQueryParams,
} from "@/lib/evalLocal/evalViewerQuery";
import {
  isBatchReviewQueueFilename,
  isCombinedReviewQueueFilename,
} from "@/lib/evalLocal/evalReviewQueueFiles";

function pickerClass(active: boolean): string {
  return [
    "rounded-md px-3 py-1.5 text-sm transition-colors",
    "outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300",
    active
      ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/80"
      : "text-zinc-500 hover:text-zinc-700",
  ].join(" ");
}

type Props = {
  basePath: string;
  searchParams: EvalViewerQueryParams;
  activeReviewName?: string;
  batchQueues: EvalFileEntry[];
  combinedQueues: EvalFileEntry[];
};

export function EvalReviewQueuePicker({
  basePath,
  searchParams,
  activeReviewName,
  batchQueues,
  combinedQueues,
}: Props) {
  const latestBatch = batchQueues[0];
  const latestCombined = combinedQueues[0];

  if (!latestBatch && !latestCombined) return null;

  const activeIsCombined =
    activeReviewName && isCombinedReviewQueueFilename(activeReviewName);
  const activeIsLatestBatch =
    activeReviewName &&
    isBatchReviewQueueFilename(activeReviewName) &&
    activeReviewName === latestBatch?.name;

  const combinedHref = latestCombined
    ? buildEvalViewerHref(
        basePath,
        patchEvalViewerQuery(searchParams, { review: "combined" }),
      )
    : undefined;

  const latestHref = latestBatch
    ? buildEvalViewerHref(
        basePath,
        patchEvalViewerQuery(searchParams, { review: "latest" }),
      )
    : undefined;

  return (
    <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-medium text-zinc-600">Review dataset</p>
        {activeReviewName ? (
          <p className="mt-0.5 font-mono text-[11px] text-zinc-400">
            {activeReviewName}
          </p>
        ) : null}
      </div>
      <div className="flex rounded-lg bg-zinc-100/80 p-0.5">
        {combinedHref ? (
          <Link
            href={combinedHref}
            className={pickerClass(Boolean(activeIsCombined))}
            aria-current={activeIsCombined ? "page" : undefined}
          >
            Combined all batches
            {latestCombined ? (
              <span className="ml-1 text-zinc-400">
                ({latestCombined.name.replace(/^review_queue_combined_/, "").replace(/\.csv$/, "")})
              </span>
            ) : null}
          </Link>
        ) : null}
        {latestHref ? (
          <Link
            href={latestHref}
            className={pickerClass(Boolean(activeIsLatestBatch))}
            aria-current={activeIsLatestBatch ? "page" : undefined}
          >
            Latest batch
            {latestBatch ? (
              <span className="ml-1 text-zinc-400">
                ({latestBatch.name.replace(/^review_queue_/, "").replace(/\.csv$/, "")})
              </span>
            ) : null}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
