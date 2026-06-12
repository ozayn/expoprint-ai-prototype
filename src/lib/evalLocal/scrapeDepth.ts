import type { BrandAuditRow } from "./brandAuditRow";

export type ScrapeDepthBucketId =
  | "0"
  | "1"
  | "2"
  | "3"
  | "4-5"
  | "6+";

export type ScrapeDepthBucket = {
  id: ScrapeDepthBucketId;
  label: string;
  count: number;
};

export type ScrapeDepthSummary = {
  buckets: ScrapeDepthBucket[];
  totalRows: number;
  summaryLine?: string;
};

const BUCKET_DEFS: { id: ScrapeDepthBucketId; label: string }[] = [
  { id: "0", label: "0 pages" },
  { id: "1", label: "1 page" },
  { id: "2", label: "2 pages" },
  { id: "3", label: "3 pages" },
  { id: "4-5", label: "4–5 pages" },
  { id: "6+", label: "6+ pages" },
];

export function parsePagesInspected(row: BrandAuditRow): number | null {
  const raw = row.pages_inspected?.trim();
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function scrapeDepthBucketForPages(pages: number | null): ScrapeDepthBucketId {
  if (pages === null || pages === 0) return "0";
  if (pages === 1) return "1";
  if (pages === 2) return "2";
  if (pages === 3) return "3";
  if (pages <= 5) return "4-5";
  return "6+";
}

function scrapeDepthSummaryLine(buckets: ScrapeDepthBucket[]): string | undefined {
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  if (total === 0) return undefined;

  const one = buckets.find((b) => b.id === "1")?.count ?? 0;
  const two = buckets.find((b) => b.id === "2")?.count ?? 0;
  if ((one + two) / total >= 0.4 && one + two > 0) {
    return "Most sites inspected 1–2 pages.";
  }

  let maxBucket = buckets[0]!;
  for (const bucket of buckets) {
    if (bucket.count > maxBucket.count) maxBucket = bucket;
  }
  if (maxBucket.count === 0) return undefined;

  if (maxBucket.id === "4-5") {
    return "Most sites inspected 4–5 pages.";
  }
  if (maxBucket.id === "6+") {
    return "Most sites inspected 6+ pages.";
  }
  return `Most sites inspected ${maxBucket.label}.`;
}

export function computeScrapeDepth(rows: BrandAuditRow[]): ScrapeDepthSummary {
  const counts: Record<ScrapeDepthBucketId, number> = {
    "0": 0,
    "1": 0,
    "2": 0,
    "3": 0,
    "4-5": 0,
    "6+": 0,
  };

  for (const row of rows) {
    const pages = parsePagesInspected(row);
    const bucket = scrapeDepthBucketForPages(pages);
    counts[bucket] += 1;
  }

  const buckets: ScrapeDepthBucket[] = BUCKET_DEFS.map((def) => ({
    id: def.id,
    label: def.label,
    count: counts[def.id],
  }));

  return {
    buckets,
    totalRows: rows.length,
    summaryLine: scrapeDepthSummaryLine(buckets),
  };
}
