#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  computeCoverageSnapshot,
  compareCoverageSnapshots,
  formatCoverageBenchmarkSummary,
  formatCoverageDeltaLine,
} from "../../../src/lib/evalLocal/coverageSnapshot.js";
import { emptyBrandAuditRow } from "../../../src/lib/evalLocal/brandAuditRow.js";

function successRow(partial: Record<string, string> = {}): import("../../../src/lib/evalLocal/brandAuditRow.js").BrandAuditRow {
  const row = emptyBrandAuditRow();
  row.status = "success";
  for (const [key, value] of Object.entries(partial)) {
    (row as Record<string, string>)[key] = value;
  }
  return row;
}

const rowsA = [
  successRow({
    extracted_business_name: "Acme",
    extracted_color_hexes: "#112233",
    extracted_products_services: "Signs",
    pages_inspected: "2",
    canonical_domain: "acme.test",
    domain: "acme.test",
    normalized_url: "https://acme.test/",
  }),
  successRow({
    extracted_business_name: "Beta",
    logo_candidate_count: "2",
    pages_inspected: "1",
    canonical_domain: "beta.test",
    domain: "beta.test",
    normalized_url: "https://beta.test/",
  }),
];

const snapshotA = computeCoverageSnapshot({
  rows: rowsA,
  snapshotId: "20260618000000000",
  timestamp: "2026-06-18T00:00:00.000Z",
  sourceReviewQueueFilename: "review_queue_combined_example_a.csv",
  urlInventoryTotal: 100,
  processedUniqueSites: 2,
});

assert.equal(snapshotA.total_rows, 2);
assert.equal(snapshotA.successful_rows, 2);
assert.equal(snapshotA.field_coverage.colors.percent, 50);
assert.equal(snapshotA.field_coverage.logo.percent, 50);
assert.equal(snapshotA.scrape_depth.pages_1.percent, 50);
assert.equal(snapshotA.scrape_depth.pages_2.percent, 50);

const rowsB = [
  ...rowsA,
  successRow({
    extracted_business_name: "Gamma",
    extracted_color_hexes: "#abcdef,#112233",
    extracted_emails: "hello@gamma.test",
    extracted_products_services: "Banners",
    pages_inspected: "4",
    canonical_domain: "gamma.test",
    domain: "gamma.test",
    normalized_url: "https://gamma.test/",
  }),
];

const snapshotB = computeCoverageSnapshot({
  rows: rowsB,
  snapshotId: "20260618120000000",
  timestamp: "2026-06-18T12:00:00.000Z",
  sourceReviewQueueFilename: "review_queue_combined_example_b.csv",
  processedUniqueSites: 3,
});

assert.equal(snapshotB.field_coverage.colors.percent, 67);

const deltas = compareCoverageSnapshots(snapshotA, snapshotB);
const colorsDelta = deltas.find((d) => d.field === "colors");
assert.ok(colorsDelta);
assert.equal(colorsDelta!.deltaPoints, 17);
assert.equal(
  formatCoverageDeltaLine(colorsDelta!),
  "Colors: 50% → 67% (+17 pts)",
);

const summary = formatCoverageBenchmarkSummary(snapshotA, snapshotB);
assert.ok(summary.includes("Colors: 50% → 67% (+17 pts)"));

console.log("coverageSnapshot.test.ts: all checks passed");
