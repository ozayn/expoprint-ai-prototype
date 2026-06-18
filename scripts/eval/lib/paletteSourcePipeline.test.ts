#!/usr/bin/env node
import assert from "node:assert/strict";
import { buildPublishedInternalEvalFile } from "../../../src/lib/evalInternal/sanitizePublishedReview.js";
import { emptyBrandAuditRow, normalizeBrandAuditRow } from "../../../src/lib/evalLocal/brandAuditRow.js";
import { mergeBrandAuditRows } from "../../../src/lib/evalLocal/evalCanonicalDedup.js";
import {
  formatPaletteSourceDisplay,
  paletteConfidenceColumnDisplay,
  paletteSourceCellDisplay,
  paletteSourceColumnDisplay,
} from "../../../src/lib/evalLocal/paletteSourceDisplay.js";
import type { ExtractionJsonlRecord } from "../../../src/lib/evalLocal/extractionTypes.js";
import {
  combinedReviewQueueToCsv,
  type CombinedReviewQueueRow,
} from "./combineReviewQueues.js";
import { csvRowsToObjects, parseCsv } from "./parseCsv.js";
import { reviewRowFromExtractionRecord } from "./historicalReviewQueue.js";

function reviewRow(overrides: Partial<ReturnType<typeof emptyBrandAuditRow>>) {
  return { ...emptyBrandAuditRow(), ...overrides };
}

function testMergePreservesPaletteFromOther(): void {
  const older = reviewRow({
    normalized_url: "https://example.com/",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    extracted_business_name: "Example Co",
    extracted_summary: "Long summary text",
    logo_candidate_count: "2",
    extracted_color_hexes: '["#111111"]',
    palette_source: "",
    processed_at: "2026-06-01T00:00:00.000Z",
    source_review_queue: "review_queue_20260601000000000.csv",
  });
  const newer = reviewRow({
    normalized_url: "https://example.com/",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    extracted_color_hexes: '["#dc143c"]',
    palette_source: "logo",
    palette_confidence: "medium",
    processed_at: "2026-06-18T00:00:00.000Z",
    source_review_queue: "review_queue_20260618000000000.csv",
  });

  const merged = mergeBrandAuditRows(older, newer);
  assert.equal(merged.palette_source, "logo");
  assert.equal(merged.palette_confidence, "medium");
}

function testCombinedCsvPreservesPaletteSource(): void {
  const rows: CombinedReviewQueueRow[] = [
    {
      ...reviewRow({
        domain: "logo.com",
        canonical_domain: "logo.com",
        normalized_url: "https://logo.com/",
        status: "success",
        extracted_color_hexes: '["#aabbcc"]',
        palette_source: "logo",
        palette_confidence: "medium",
        source_review_queue: "review_queue_20260618000000000.csv",
      }),
      source_review_queue: "review_queue_20260618000000000.csv",
    },
  ];

  const csv = combinedReviewQueueToCsv(rows);
  assert.ok(csv.includes("palette_source"));
  assert.ok(csv.includes("palette_confidence"));

  const { records } = csvRowsToObjects(parseCsv(csv));
  assert.equal(records[0]?.palette_source, "logo");
  assert.equal(records[0]?.palette_confidence, "medium");
}

function testPublishedJsonPreservesPaletteSource(): void {
  const { file } = buildPublishedInternalEvalFile(
    "review_queue_test.csv",
    [
      {
        normalized_url: "https://example.com/",
        domain: "example.com",
        canonical_domain: "example.com",
        status: "success",
        extracted_color_hexes: '["#112233"]',
        palette_source: "extraction",
        palette_confidence: "high",
      },
    ],
    { includeDomains: true, includeLogoUrls: false },
  );

  const row = file.rows[0]!;
  assert.equal(row.palette_source, "extraction");
  assert.equal(row.palette_confidence, "high");

  const normalized = normalizeBrandAuditRow(row);
  assert.ok(normalized);
  assert.equal(normalized.palette_source, "extraction");
}

function testReviewRowMapsBrandPaletteSource(): void {
  const record: ExtractionJsonlRecord = {
    input: {
      ds_id: "1",
      ds_number: "DS-1",
      project_title: "T",
      project_type: "",
      shop_code: "",
      source_column: "first_req_description",
      normalized_url: "https://example.com/",
      domain: "example.com",
      canonical_domain: "example.com",
      first_req_description: "",
      first_req_note: "",
    },
    status: "success",
    elapsed_ms: 100,
    expo_output: {
      ok: true,
      business: {
        name: "Example",
        website: "",
        domain: "example.com",
        canonicalUrl: "",
      },
      brand: {
        colors: ["#112233"],
        paletteSource: "logo",
        paletteConfidence: "medium",
        typography: {
          fontFamilies: [],
          headingFontCandidates: [],
          bodyFontCandidates: [],
          googleFontFamilies: [],
          styleGuess: "unknown",
        },
        logoCandidates: [],
      },
      content: {
        services: [],
        products: [],
        contact: { phone: "", email: "", address: "", social: [] },
      },
      designIntake: {
        productCategory: "",
        components: [],
        stylePreference: "",
        recommendedHeadline: "",
        recommendedSupportingText: "",
        missingAssets: [],
        confidenceNotes: [],
        needsHumanReview: false,
      },
      metadata: {
        source: "scraper_plus_claude",
        pagesInspected: 1,
        durationMs: 100,
        websiteFetch: { status: "success", reason: "" },
        claude: { attempted: true, model: "test", status: "success" },
        warnings: [],
      },
    },
  };

  const row = reviewRowFromExtractionRecord(record);
  assert.equal(row.palette_source, "logo");
  assert.equal(
    formatPaletteSourceDisplay(row),
    "Palette source: logo / medium",
  );
  assert.equal(paletteSourceCellDisplay(row), "logo / medium");
}

function testDedicatedColumnsRenderPaletteMetadata(): void {
  const row = reviewRow({
    extracted_color_hexes: '["#112233"]',
    palette_source: "logo",
    palette_confidence: "medium",
    status: "success",
  });
  assert.equal(paletteSourceColumnDisplay(row), "logo");
  assert.equal(paletteConfidenceColumnDisplay(row), "medium");
  assert.equal(paletteSourceCellDisplay(row), "logo / medium");
}

function testNormalizeBrandAuditRowCamelCasePalette(): void {
  const normalized = normalizeBrandAuditRow({
    paletteSource: "logo",
    paletteConfidence: "high",
    extracted_color_hexes: '["#111111"]',
  });
  assert.ok(normalized);
  assert.equal(normalized.palette_source, "logo");
  assert.equal(normalized.palette_confidence, "high");
}

function testCsvRowsMapPaletteColumns(): void {
  const csv =
    "palette_source,palette_confidence,extracted_color_hexes,status\n" +
    "logo,medium,[\"#aabbcc\"],success\n";
  const { records } = csvRowsToObjects(parseCsv(csv));
  const row = normalizeBrandAuditRow(records[0]);
  assert.ok(row);
  assert.equal(row.palette_source, "logo");
  assert.equal(row.palette_confidence, "medium");
  assert.equal(paletteSourceColumnDisplay(row), "logo");
  assert.equal(paletteConfidenceColumnDisplay(row), "medium");
}

function testPublishedJsonCamelCasePalette(): void {
  const normalized = normalizeBrandAuditRow({
    extracted_color_hexes: '["#222222"]',
    paletteSource: "extraction",
    paletteConfidence: "unknown",
  });
  assert.ok(normalized);
  assert.equal(normalized.palette_source, "extraction");
  assert.equal(normalized.palette_confidence, "unknown");
  assert.equal(paletteSourceColumnDisplay(normalized), "extraction");
  assert.equal(paletteConfidenceColumnDisplay(normalized), "unknown");
}

function testDisplayUnknownWhenColorsWithoutSource(): void {
  const row = reviewRow({
    extracted_color_hexes: '["#112233"]',
    palette_source: "",
    palette_confidence: "",
    status: "success",
  });
  assert.equal(formatPaletteSourceDisplay(row), "Palette source unknown");
  assert.equal(paletteSourceColumnDisplay(row), "unknown");
  assert.equal(paletteConfidenceColumnDisplay(row), "unknown");
  assert.equal(paletteSourceCellDisplay(row), "unknown / unknown");
}

function main(): void {
  testMergePreservesPaletteFromOther();
  testCombinedCsvPreservesPaletteSource();
  testPublishedJsonPreservesPaletteSource();
  testReviewRowMapsBrandPaletteSource();
  testDedicatedColumnsRenderPaletteMetadata();
  testNormalizeBrandAuditRowCamelCasePalette();
  testCsvRowsMapPaletteColumns();
  testPublishedJsonCamelCasePalette();
  testDisplayUnknownWhenColorsWithoutSource();
  console.log("paletteSourcePipeline.test.ts: all checks passed");
}

main();
