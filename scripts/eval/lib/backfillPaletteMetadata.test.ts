#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  applyBackfillPaletteMetadataToRow,
  backfillPaletteMetadataOnRows,
  colorsLookLikeLogoDerived,
  inferBackfillPaletteMetadata,
  rowNeedsPaletteBackfill,
} from "../../../src/lib/evalLocal/backfillPaletteMetadata.js";
import { emptyBrandAuditRow } from "../../../src/lib/evalLocal/brandAuditRow.js";
import type { ReviewQueueRow } from "../../../src/lib/evalLocal/reviewQueueTypes.js";
import { combinedReviewQueueToCsv } from "./combineReviewQueues.js";
import { backfillPaletteMetadataFile } from "./backfillPaletteMetadataLib.js";
import { csvRowsToObjects, parseCsv } from "./parseCsv.js";
import { EVAL_RESULTS_DIR } from "./paths.js";

function row(overrides: Partial<ReviewQueueRow>): ReviewQueueRow {
  return { ...emptyBrandAuditRow(), ...overrides };
}

function testColorsWithEmptySource(): void {
  const input = row({
    domain: "example.com",
    extracted_color_hexes: '["#111111","#222222"]',
    primary_color_hex: "#111111",
    secondary_color_hex: "#222222",
    palette_source: "",
    palette_confidence: "",
  });
  assert.equal(rowNeedsPaletteBackfill(input), true);
  const inference = inferBackfillPaletteMetadata(input);
  assert.equal(inference?.palette_source, "extraction");
  assert.equal(inference?.palette_confidence, "unknown");
}

function testColorsWithExistingSource(): void {
  const input = row({
    extracted_color_hexes: '["#111111"]',
    palette_source: "logo",
    palette_confidence: "medium",
  });
  assert.equal(rowNeedsPaletteBackfill(input), false);
  assert.equal(inferBackfillPaletteMetadata(input), null);
}

function testLogoPresentInfersLogo(): void {
  const input = row({
    domain: "logo.com",
    extracted_color_hexes: '["#111111","#222222","#333333"]',
    primary_color_hex: "#111111",
    secondary_color_hex: "#222222",
    selected_logo_url: "https://logo.com/logo.png",
    logo_candidate_count: "2",
    palette_source: "",
  });
  const inference = inferBackfillPaletteMetadata(input);
  assert.equal(inference?.palette_source, "logo");
  assert.equal(inference?.palette_confidence, "medium");
  assert.equal(inference?.reason, "logo");
}

function testNoColorsNoBackfill(): void {
  const input = row({
    palette_source: "",
    extracted_color_hexes: "",
    primary_color_hex: "",
    secondary_color_hex: "",
  });
  assert.equal(rowNeedsPaletteBackfill(input), false);
  assert.equal(inferBackfillPaletteMetadata(input), null);
}

function testLogoLikeColorsWithoutPrimarySecondary(): void {
  const input = row({
    extracted_color_hexes: '["#111111","#222222","#333333"]',
    palette_source: "",
  });
  assert.equal(colorsLookLikeLogoDerived(input), true);
  const inference = inferBackfillPaletteMetadata(input);
  assert.equal(inference?.reason, "logo");
}

function testCombinedCsvBackfill(): void {
  const csvPath = join(
    EVAL_RESULTS_DIR,
    "review_queue_combined_20260618169999999.csv",
  );
  const rows = [
    row({
      normalized_url: "https://a.com/",
      domain: "a.com",
      canonical_domain: "a.com",
      extracted_color_hexes: '["#aaaaaa","#bbbbbb"]',
      primary_color_hex: "#aaaaaa",
      secondary_color_hex: "#bbbbbb",
      palette_source: "",
      source_review_queue: "review_queue_test.csv",
    }),
    row({
      normalized_url: "https://b.com/",
      domain: "b.com",
      canonical_domain: "b.com",
      selected_logo_url: "https://b.com/logo.png",
      extracted_color_hexes: '["#cccccc","#dddddd","#eeeeee"]',
      palette_source: "",
      palette_confidence: "",
      source_review_queue: "review_queue_test.csv",
    }),
  ] as ReviewQueueRow[];

  writeFileSync(
    csvPath,
    combinedReviewQueueToCsv(
      rows.map((r) => ({
        ...r,
        source_review_queue: r.source_review_queue ?? "",
      })),
    ),
    "utf8",
  );

  try {
    const dry = backfillPaletteMetadataFile(csvPath, {
      dryRun: true,
      publishAfterCombined: false,
    });
    assert.equal(dry.summary.rowsUpdated, 2);
    assert.equal(dry.outputPaths.length, 0);

    const result = backfillPaletteMetadataFile(csvPath, {
      dryRun: false,
      publishAfterCombined: false,
    });
    assert.equal(result.summary.rowsUpdated, 2);
    assert.equal(result.summary.logoInferred, 1);
    assert.equal(result.summary.extractionInferred, 1);
    assert.ok(result.outputPaths.includes(csvPath));

    const text = readFileSync(csvPath, "utf8");
    const { records } = csvRowsToObjects(parseCsv(text));
    const byUrl = new Map(records.map((r) => [r.normalized_url, r]));
    assert.equal(byUrl.get("https://a.com/")?.palette_source, "extraction");
    assert.equal(byUrl.get("https://b.com/")?.palette_source, "logo");
  } finally {
    rmSync(csvPath, { force: true });
  }
}

function testPublishedJsonBackfill(): void {
  const dir = mkdtempSync(join(tmpdir(), "palette-backfill-json-"));
  const jsonPath = join(dir, "internal-eval-review.json");
  writeFileSync(
    jsonPath,
    JSON.stringify({
      description: "test",
      published_at: "2026-01-01T00:00:00.000Z",
      source_review_queue: "review_queue_test.csv",
      include_domains: true,
      include_logo_urls: true,
      rows: [
        row({
          domain: "json.com",
          extracted_color_hexes: '["#111111","#222222"]',
          palette_source: "",
        }),
      ],
    }),
    "utf8",
  );

  const result = backfillPaletteMetadataFile(jsonPath, { dryRun: false });
  assert.equal(result.summary.rowsUpdated, 1);
  const parsed = JSON.parse(readFileSync(jsonPath, "utf8")) as {
    rows: Array<{ palette_source: string }>;
  };
  assert.equal(parsed.rows[0]?.palette_source, "logo");
}

function testBackfillOnRowsSummary(): void {
  const { summary } = backfillPaletteMetadataOnRows([
    row({
      extracted_color_hexes: '["#111111"]',
      palette_source: "logo",
    }),
    row({
      extracted_color_hexes: '["#222222","#333333"]',
      primary_color_hex: "#222222",
      secondary_color_hex: "#333333",
      palette_source: "",
    }),
  ]);
  assert.equal(summary.rowsUpdated, 1);
  assert.equal(summary.extractionInferred, 1);
}

function testApplyDoesNotTouchOtherFields(): void {
  const input = row({
    normalized_url: "https://keep.com/",
    extracted_color_hexes: '["#111111","#222222"]',
    selected_logo_url: "https://keep.com/logo.png",
    palette_source: "",
  });
  const { row: next } = applyBackfillPaletteMetadataToRow(input);
  assert.equal(next.normalized_url, input.normalized_url);
  assert.equal(next.extracted_color_hexes, input.extracted_color_hexes);
  assert.equal(next.selected_logo_url, input.selected_logo_url);
  assert.equal(next.palette_source, "logo");
}

function main(): void {
  testColorsWithEmptySource();
  testColorsWithExistingSource();
  testLogoPresentInfersLogo();
  testNoColorsNoBackfill();
  testLogoLikeColorsWithoutPrimarySecondary();
  testCombinedCsvBackfill();
  testPublishedJsonBackfill();
  testBackfillOnRowsSummary();
  testApplyDoesNotTouchOtherFields();
  console.log("backfillPaletteMetadata.test.ts: all checks passed");
}

main();
