import { CoverageByFieldChart } from "./CoverageByFieldChart";
import { ScrapeDepthChart } from "./ScrapeDepthChart";
import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";
import type { UrlInventoryStats } from "@/lib/evalLocal/urlInventoryJoin";

type Props = {
  rows: BrandAuditRow[];
  inventoryStats?: UrlInventoryStats | null;
};

function formatInventoryStatsLine(stats: UrlInventoryStats): string {
  const parts = [
    `${stats.totalCandidates.toLocaleString()} URL candidates`,
    `${stats.uniqueDomains.toLocaleString()} unique domains`,
    `${stats.processedCount.toLocaleString()} processed`,
    `${stats.notRunCount.toLocaleString()} not run`,
  ];
  if (stats.failedCount > 0) {
    parts.push(`${stats.failedCount.toLocaleString()} failed`);
  }
  return parts.join(" · ");
}

export function BrandAuditCoverageSummary({ rows, inventoryStats }: Props) {
  const hasExtraction = rows.length > 0;
  const hasInventory = inventoryStats && inventoryStats.totalCandidates > 0;

  if (!hasExtraction && !hasInventory) {
    return null;
  }

  return (
    <section className="mb-6 border-b border-zinc-200/60 pb-6">
      {hasInventory ? (
        <div className="mb-5">
          <h2 className="text-sm font-medium text-zinc-800">URL inventory</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {formatInventoryStatsLine(inventoryStats!)}
          </p>
        </div>
      ) : null}

      {hasExtraction ? (
        <div className="grid gap-8 md:grid-cols-2 md:gap-6">
          <CoverageByFieldChart rows={rows} />
          <ScrapeDepthChart rows={rows} />
        </div>
      ) : null}
    </section>
  );
}
