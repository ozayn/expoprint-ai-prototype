import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  computeCoverageSnapshot,
  compareCoverageSnapshots,
  formatCoverageDeltaLine,
  parseCoverageSnapshotsFile,
  type CoverageSnapshot,
  type CoverageSnapshotsFile,
} from "../../../src/lib/evalLocal/coverageSnapshot.js";
import {
  buildUrlInventory,
  computeUrlInventoryStats,
} from "../../../src/lib/evalLocal/urlInventoryJoin.js";
import { canonicalSiteDedupeKeyFromFields } from "../../../src/lib/evalLocal/evalCanonicalDedup.js";
import { findLatestCombinedReviewQueuePath } from "./combineReviewQueues.js";
import type { ReviewQueueRow } from "./historicalReviewQueue.js";
import {
  COVERAGE_SNAPSHOTS_FILENAME,
  EVAL_BENCHMARKS_DIR,
  EVAL_RESULTS_DIR,
  ensureEvalDirs,
  runTimestampId,
} from "./paths.js";
import {
  readReviewQueueCsvFromPath,
  reviewQueueFilenameFromPath,
} from "./readReviewQueueCsv.js";
import { readUrlCandidatesCsvSync, pickUrlCandidatesFilePath } from "./urlCandidatesFile.js";

export type WriteCoverageSnapshotOptions = {
  reviewQueuePath: string;
  includeInventory?: boolean;
  resultsDir?: string;
  benchmarksDir?: string;
};

export type WriteCoverageSnapshotResult = {
  snapshot: CoverageSnapshot;
  outputPath: string;
  previousSnapshot: CoverageSnapshot | null;
  deltasPrinted: string[];
  inventoryAttached: boolean;
};

function coverageSnapshotsPath(benchmarksDir: string): string {
  return join(benchmarksDir, COVERAGE_SNAPSHOTS_FILENAME);
}

function loadSnapshotsFile(path: string): CoverageSnapshotsFile {
  if (!existsSync(path)) {
    return { snapshots: [] };
  }
  const text = readFileSync(path, "utf8");
  return parseCoverageSnapshotsFile(text);
}

function countProcessedUniqueSites(rows: ReviewQueueRow[]): number {
  const sites = new Set<string>();
  for (const row of rows) {
    const key = canonicalSiteDedupeKeyFromFields({
      canonical_domain: row.canonical_domain,
      domain: row.domain,
      normalized_url: row.normalized_url,
    });
    if (key) sites.add(key);
  }
  return sites.size;
}

function tryInventoryStats(
  reviewRows: ReviewQueueRow[],
  resultsDir: string,
  reviewQueueFilename: string,
): { urlInventoryTotal?: number; processedUniqueSites?: number } | null {
  try {
    const { filename } = pickUrlCandidatesFilePath(resultsDir);
    const candidates = readUrlCandidatesCsvSync(resultsDir, filename);
    const inventory = buildUrlInventory(candidates, reviewRows, "snapshot", {
      reviewQueueFilename,
    });
    const stats = computeUrlInventoryStats(
      inventory.rows,
      inventory.rawRows.length,
    );
    return {
      urlInventoryTotal: stats.totalRawCandidates,
      processedUniqueSites: stats.processedCount,
    };
  } catch {
    return null;
  }
}

export function writeCoverageSnapshot(
  options: WriteCoverageSnapshotOptions,
): WriteCoverageSnapshotResult {
  const resultsDir = options.resultsDir ?? EVAL_RESULTS_DIR;
  const benchmarksDir = options.benchmarksDir ?? EVAL_BENCHMARKS_DIR;
  ensureEvalDirs();

  const reviewQueuePath = options.reviewQueuePath;
  const reviewQueueFilename = reviewQueueFilenameFromPath(reviewQueuePath);
  const rows = readReviewQueueCsvFromPath(reviewQueuePath);

  let urlInventoryTotal: number | undefined;
  let processedUniqueSites: number | undefined;
  let inventoryAttached = false;

  if (options.includeInventory) {
    const inventoryStats = tryInventoryStats(
      rows,
      resultsDir,
      reviewQueueFilename,
    );
    if (inventoryStats) {
      urlInventoryTotal = inventoryStats.urlInventoryTotal;
      processedUniqueSites = inventoryStats.processedUniqueSites;
      inventoryAttached = true;
    }
  }

  if (processedUniqueSites === undefined) {
    processedUniqueSites = countProcessedUniqueSites(rows);
  }

  const snapshotId = runTimestampId();
  const snapshot = computeCoverageSnapshot({
    rows,
    snapshotId,
    sourceReviewQueueFilename: reviewQueueFilename,
    urlInventoryTotal,
    processedUniqueSites,
  });

  const snapshotsPath = coverageSnapshotsPath(benchmarksDir);
  const file = loadSnapshotsFile(snapshotsPath);
  const previousSnapshot =
    file.snapshots.length > 0 ? file.snapshots[file.snapshots.length - 1]! : null;

  file.snapshots.push(snapshot);
  writeFileSync(snapshotsPath, `${JSON.stringify(file, null, 2)}\n`, "utf8");

  const deltasPrinted =
    previousSnapshot
      ? compareCoverageSnapshots(previousSnapshot, snapshot).map(
          formatCoverageDeltaLine,
        )
      : [];

  return {
    snapshot,
    outputPath: snapshotsPath,
    previousSnapshot,
    deltasPrinted,
    inventoryAttached,
  };
}

export function resolveReviewQueuePathForSnapshot(args: {
  positionalPath?: string;
  latestCombined?: boolean;
  resultsDir?: string;
}): string {
  if (args.latestCombined) {
    return findLatestCombinedReviewQueuePath(args.resultsDir ?? EVAL_RESULTS_DIR);
  }
  if (!args.positionalPath) {
    throw new Error(
      "Provide a review queue CSV path or use --latest-combined",
    );
  }
  return args.positionalPath;
}

export function printCoverageSnapshotSummary(
  result: WriteCoverageSnapshotResult,
): void {
  const s = result.snapshot;

  console.log("Coverage snapshot written");
  console.log(`  Snapshot id:           ${s.snapshot_id}`);
  console.log(`  Source review queue:   ${s.source_review_queue}`);
  console.log(`  Output:                ${result.outputPath}`);
  console.log(`  Total rows:            ${s.total_rows}`);
  console.log(`  Successful:            ${s.successful_rows}`);
  console.log(`  Failed:                ${s.failed_rows}`);
  if (s.url_inventory_total !== undefined) {
    console.log(`  URL inventory total:   ${s.url_inventory_total}`);
  }
  if (s.processed_unique_sites !== undefined) {
    console.log(`  Processed unique sites:${s.processed_unique_sites}`);
  }
  if (!result.inventoryAttached) {
    console.log(
      "  URL inventory:         not joined (pass --include-inventory or ensure url_candidates CSV exists)",
    );
  }

  console.log("");
  console.log("Field coverage (successful rows):");
  for (const [key, metrics] of Object.entries(s.field_coverage)) {
    console.log(`  ${key}: ${metrics.count} (${metrics.percent}%)`);
  }

  console.log("");
  console.log("Scrape depth (all rows):");
  for (const [key, metrics] of Object.entries(s.scrape_depth)) {
    console.log(`  ${key}: ${metrics.count} (${metrics.percent}%)`);
  }

  if (result.deltasPrinted.length > 0) {
    console.log("");
    console.log("Changes vs previous snapshot:");
    for (const line of result.deltasPrinted) {
      console.log(`  ${line}`);
    }
  } else if (result.previousSnapshot) {
    console.log("");
    console.log("No field coverage changes vs previous snapshot.");
  } else {
    console.log("");
    console.log("First snapshot — no prior checkpoint to compare.");
  }
}
