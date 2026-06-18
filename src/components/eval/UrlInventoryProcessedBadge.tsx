import { formatProcessedLabel } from "@/lib/evalLocal/evalProcessedMeta";
import type { UrlInventoryProcessedMeta } from "@/lib/evalLocal/evalProcessedMeta";

export function UrlInventoryProcessedBadge({
  processedMeta,
}: {
  processedMeta: UrlInventoryProcessedMeta | null;
}) {
  if (!processedMeta?.processedAt && !processedMeta?.isLatestBatch) {
    return null;
  }

  const label = formatProcessedLabel(
    processedMeta.processedAt,
    processedMeta.isLatestBatch,
  );
  if (!label) return null;

  return (
    <span
      className="ml-1.5 inline-block rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500"
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
