import assert from "node:assert/strict";
import sharp from "sharp";
import { runColorExtractionAudit } from "./auditColorExtraction.js";
import { extractDominantHexColorsFromImageBuffer } from "../../../src/lib/server/logoPaletteExtraction.js";
import {
  reviewRowFromExtractionRecord,
} from "./historicalReviewQueue.js";
import type { ExtractionJsonlRecord } from "../../../src/lib/evalLocal/extractionTypes.js";
import { EVAL_RUNS_DIR } from "./paths.js";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

async function testLogoPaletteFromRedImage(): Promise<void> {
  const png = await sharp({
    create: {
      width: 16,
      height: 16,
      channels: 3,
      background: { r: 220, g: 20, b: 30 },
    },
  })
    .png()
    .toBuffer();

  const colors = await extractDominantHexColorsFromImageBuffer(png);
  assert.ok(colors.length >= 1);
  assert.ok(colors[0]?.includes("dc") || colors[0]?.includes("dd"));
}

function testReviewRowPaletteFields(): void {
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
        website: "https://example.com/",
        domain: "example.com",
        canonicalUrl: "https://example.com/",
      },
      brand: {
        colors: ["#112233"],
        typography: {
          fontFamilies: [],
          headingFontCandidates: [],
          bodyFontCandidates: [],
          googleFontFamilies: [],
          styleGuess: "unknown",
        },
        logoCandidates: [],
        paletteSource: "extraction",
        paletteConfidence: "high",
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
  assert.equal(row.palette_source, "extraction");
  assert.equal(row.palette_confidence, "high");
}

function testColorAuditSummary(): void {
  const runId = "20990101120000000";
  const jsonlPath = join(EVAL_RUNS_DIR, `extraction_run_${runId}.jsonl`);
  const line = JSON.stringify({
    input: {
      ds_id: "1",
      ds_number: "DS-1",
      project_title: "T",
      project_type: "",
      shop_code: "",
      source_column: "first_req_description",
      normalized_url: "https://logo-only.com/",
      domain: "logo-only.com",
      canonical_domain: "logo-only.com",
      first_req_description: "",
      first_req_note: "",
    },
    status: "success",
    elapsed_ms: 100,
    expo_output: {
      ok: true,
      business: {
        name: "Logo Only",
        website: "",
        domain: "logo-only.com",
        canonicalUrl: "",
      },
      brand: {
        colors: [],
        typography: {
          fontFamilies: [],
          headingFontCandidates: [],
          bodyFontCandidates: [],
          googleFontFamilies: [],
          styleGuess: "unknown",
        },
        logoCandidates: [{ url: "https://logo-only.com/logo.png", source: "img-logo" }],
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
        source: "scraper_only",
        pagesInspected: 1,
        durationMs: 100,
        websiteFetch: { status: "success", reason: "" },
        claude: { attempted: false, model: "", status: "skipped" },
        warnings: [],
      },
    },
  });
  writeFileSync(jsonlPath, `${line}\n`, "utf8");

  const summary = runColorExtractionAudit(jsonlPath);
  assert.equal(summary.totalRows, 1);
  assert.equal(summary.rowsWithLogos, 1);
  assert.equal(summary.logosWithoutColors, 1);

  unlinkSync(summary.outputPath);
  unlinkSync(jsonlPath);
}

async function main(): Promise<void> {
  await testLogoPaletteFromRedImage();
  testReviewRowPaletteFields();
  testColorAuditSummary();
  console.log("color extraction tests: all checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
