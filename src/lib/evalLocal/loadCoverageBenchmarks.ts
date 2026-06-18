import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type CoverageSnapshot,
  formatCoverageBenchmarkSummary,
  parseCoverageSnapshotsFile,
} from "./coverageSnapshot";

export type CoverageBenchmarkSummary = {
  latest: CoverageSnapshot;
  previous: CoverageSnapshot | null;
  deltaSummary: string | null;
  snapshotCount: number;
};

const SNAPSHOTS_RELATIVE = "data/eval/benchmarks/coverage_snapshots.json";

export function coverageSnapshotsFilePath(repoRoot: string): string {
  return join(repoRoot, SNAPSHOTS_RELATIVE);
}

export function loadCoverageSnapshots(repoRoot: string): CoverageSnapshot[] {
  const path = coverageSnapshotsFilePath(repoRoot);
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf8");
  return parseCoverageSnapshotsFile(text).snapshots;
}

export function loadCoverageBenchmarkSummary(
  repoRoot: string,
): CoverageBenchmarkSummary | null {
  const snapshots = loadCoverageSnapshots(repoRoot);
  if (snapshots.length === 0) return null;

  const latest = snapshots[snapshots.length - 1]!;
  const previous =
    snapshots.length >= 2 ? snapshots[snapshots.length - 2]! : null;
  const deltaSummary =
    previous ? formatCoverageBenchmarkSummary(previous, latest) : null;

  return {
    latest,
    previous,
    deltaSummary,
    snapshotCount: snapshots.length,
  };
}
