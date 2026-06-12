import { EvalHorizontalBars, barWidthsFromCounts } from "./EvalHorizontalBars";
import { computeScrapeDepth } from "@/lib/evalLocal/scrapeDepth";
import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";

type Props = {
  rows: BrandAuditRow[];
};

export function ScrapeDepthChart({ rows }: Props) {
  const depth = computeScrapeDepth(rows);

  if (depth.totalRows === 0) {
    return null;
  }

  const barWidths = barWidthsFromCounts(depth.buckets.map((b) => b.count));

  const items = depth.buckets.map((bucket, index) => ({
    key: bucket.id,
    label: bucket.label,
    count: bucket.count,
    barPercent: barWidths[index] ?? 0,
    detail:
      depth.totalRows > 0
        ? `${Math.round((bucket.count / depth.totalRows) * 100)}%`
        : undefined,
  }));

  return (
    <div>
      <h3 className="text-sm font-medium text-zinc-800">Scrape depth</h3>
      <p className="mt-1 text-xs text-zinc-500">
        How many pages ExpoPrint inspected per website.
      </p>

      <div className="mt-4">
        <EvalHorizontalBars
          items={items}
          emptyMessage="No page inspection data."
        />
      </div>

      {depth.summaryLine ? (
        <p className="mt-4 text-xs text-zinc-500">{depth.summaryLine}</p>
      ) : null}
    </div>
  );
}
