import type { BrandAuditRow } from "./brandAuditRow";
import { computeExtractionCoverage } from "./extractionCoverage";
import {
  scrapeDepthBucketForPages,
  parsePagesInspected,
  type ScrapeDepthBucketId,
} from "./scrapeDepth";

/** Aggregate field metrics stored in benchmark snapshots (no row-level data). */
export type CoverageSnapshotFieldMetrics = {
  count: number;
  percent: number;
};

export type CoverageSnapshotScrapeDepth = {
  unknown_or_0: CoverageSnapshotFieldMetrics;
  pages_1: CoverageSnapshotFieldMetrics;
  pages_2: CoverageSnapshotFieldMetrics;
  pages_3: CoverageSnapshotFieldMetrics;
  pages_4_5: CoverageSnapshotFieldMetrics;
  pages_6_plus: CoverageSnapshotFieldMetrics;
};

export type CoverageSnapshotFieldCoverage = {
  business_name: CoverageSnapshotFieldMetrics;
  logo: CoverageSnapshotFieldMetrics;
  colors: CoverageSnapshotFieldMetrics;
  email: CoverageSnapshotFieldMetrics;
  phone: CoverageSnapshotFieldMetrics;
  social_links: CoverageSnapshotFieldMetrics;
  address_location: CoverageSnapshotFieldMetrics;
  products_services: CoverageSnapshotFieldMetrics;
  summary: CoverageSnapshotFieldMetrics;
};

export type CoverageSnapshot = {
  snapshot_id: string;
  /** ISO-8601 timestamp when the snapshot was recorded. */
  timestamp: string;
  /** Review queue filename only (no path). */
  source_review_queue: string;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  url_inventory_total?: number;
  processed_unique_sites?: number;
  field_coverage: CoverageSnapshotFieldCoverage;
  scrape_depth: CoverageSnapshotScrapeDepth;
};

export type CoverageSnapshotsFile = {
  snapshots: CoverageSnapshot[];
};

const SCRAPE_DEPTH_KEYS: Record<
  ScrapeDepthBucketId,
  keyof CoverageSnapshotScrapeDepth
> = {
  "0": "unknown_or_0",
  "1": "pages_1",
  "2": "pages_2",
  "3": "pages_3",
  "4-5": "pages_4_5",
  "6+": "pages_6_plus",
};

const FIELD_ID_TO_SNAPSHOT_KEY: Record<
  string,
  keyof CoverageSnapshotFieldCoverage
> = {
  business_name: "business_name",
  logos: "logo",
  colors: "colors",
  emails: "email",
  phones: "phone",
  social: "social_links",
  address: "address_location",
  products_services: "products_services",
  summary: "summary",
};

export const COVERAGE_SNAPSHOT_FIELD_LABELS: Record<
  keyof CoverageSnapshotFieldCoverage,
  string
> = {
  business_name: "Business name",
  logo: "Logos",
  colors: "Colors",
  email: "Emails",
  phone: "Phones",
  social_links: "Social links",
  address_location: "Address",
  products_services: "Products/services",
  summary: "Summary",
};

export const COVERAGE_BENCHMARK_TRACKED_FIELDS: (keyof CoverageSnapshotFieldCoverage)[] = [
  "colors",
  "products_services",
  "business_name",
  "logo",
  "email",
  "phone",
  "social_links",
  "address_location",
  "summary",
];

function emptyScrapeDepth(): CoverageSnapshotScrapeDepth {
  const zero = (): CoverageSnapshotFieldMetrics => ({ count: 0, percent: 0 });
  return {
    unknown_or_0: zero(),
    pages_1: zero(),
    pages_2: zero(),
    pages_3: zero(),
    pages_4_5: zero(),
    pages_6_plus: zero(),
  };
}

function metricsFromCount(count: number, total: number): CoverageSnapshotFieldMetrics {
  const percent = total === 0 ? 0 : Math.round((count / total) * 100);
  return { count, percent };
}

export function computeScrapeDepthSnapshot(
  rows: BrandAuditRow[],
): CoverageSnapshotScrapeDepth {
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

  const total = rows.length;
  const result = emptyScrapeDepth();
  for (const [bucketId, key] of Object.entries(SCRAPE_DEPTH_KEYS) as [
    ScrapeDepthBucketId,
    keyof CoverageSnapshotScrapeDepth,
  ][]) {
    result[key] = metricsFromCount(counts[bucketId], total);
  }
  return result;
}

export function computeCoverageSnapshot(params: {
  rows: BrandAuditRow[];
  snapshotId: string;
  timestamp?: string;
  sourceReviewQueueFilename: string;
  urlInventoryTotal?: number;
  processedUniqueSites?: number;
}): CoverageSnapshot {
  const coverage = computeExtractionCoverage(params.rows);
  const scrapeDepth = computeScrapeDepthSnapshot(params.rows);

  const fieldCoverage = {} as CoverageSnapshotFieldCoverage;
  for (const field of coverage.fields) {
    const key = FIELD_ID_TO_SNAPSHOT_KEY[field.id];
    if (key) {
      fieldCoverage[key] = { count: field.count, percent: field.percent };
    }
  }

  const snapshot: CoverageSnapshot = {
    snapshot_id: params.snapshotId,
    timestamp: params.timestamp ?? new Date().toISOString(),
    source_review_queue: params.sourceReviewQueueFilename,
    total_rows: coverage.totalRows,
    successful_rows: coverage.successfulRows,
    failed_rows: coverage.failedRows,
    field_coverage: fieldCoverage,
    scrape_depth: scrapeDepth,
  };

  if (params.urlInventoryTotal !== undefined) {
    snapshot.url_inventory_total = params.urlInventoryTotal;
  }
  if (params.processedUniqueSites !== undefined) {
    snapshot.processed_unique_sites = params.processedUniqueSites;
  }

  return snapshot;
}

export type CoverageFieldDelta = {
  field: keyof CoverageSnapshotFieldCoverage;
  label: string;
  previousPercent: number;
  currentPercent: number;
  deltaPoints: number;
};

export function compareCoverageSnapshots(
  previous: CoverageSnapshot,
  current: CoverageSnapshot,
): CoverageFieldDelta[] {
  const deltas: CoverageFieldDelta[] = [];

  for (const field of COVERAGE_BENCHMARK_TRACKED_FIELDS) {
    const prev = previous.field_coverage[field]?.percent ?? 0;
    const next = current.field_coverage[field]?.percent ?? 0;
    if (prev === next) continue;
    deltas.push({
      field,
      label: COVERAGE_SNAPSHOT_FIELD_LABELS[field],
      previousPercent: prev,
      currentPercent: next,
      deltaPoints: next - prev,
    });
  }

  return deltas.sort((a, b) => Math.abs(b.deltaPoints) - Math.abs(a.deltaPoints));
}

export function formatCoverageDeltaLine(delta: CoverageFieldDelta): string {
  const sign =
    delta.deltaPoints > 0
      ? `+${delta.deltaPoints}`
      : `${delta.deltaPoints}`;
  return `${delta.label}: ${delta.previousPercent}% → ${delta.currentPercent}% (${sign} pts)`;
}

export function formatCoverageBenchmarkSummary(
  previous: CoverageSnapshot,
  current: CoverageSnapshot,
  options?: { maxFields?: number },
): string {
  const deltas = compareCoverageSnapshots(previous, current);
  const maxFields = options?.maxFields ?? 4;
  const parts = deltas.slice(0, maxFields).map(formatCoverageDeltaLine);
  return parts.join(". ");
}

export function parseCoverageSnapshotsFile(
  json: string,
): CoverageSnapshotsFile {
  const parsed = JSON.parse(json) as CoverageSnapshotsFile;
  if (!parsed || !Array.isArray(parsed.snapshots)) {
    throw new Error("Invalid coverage snapshots file: expected { snapshots: [] }");
  }
  return parsed;
}
