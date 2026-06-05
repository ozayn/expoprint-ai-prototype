#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  excerptText,
  parseExtractionJsonl,
  reviewRowFromExtractionRecord,
} from "./historicalReviewQueue.js";

function testExcerpt(): void {
  const long = "a ".repeat(200);
  const out = excerptText(long, 240);
  assert.ok(out.length <= 240);
  assert.ok(out.endsWith("…"));
}

function testParseAndReviewRow(): void {
  const line = JSON.stringify({
    input: {
      ds_id: "x",
      ds_number: "DS-1",
      project_title: "Acme Booth",
      project_type: "BUNDLE",
      shop_code: "ex",
      source_column: "first_req_description",
      normalized_url: "https://example.com/",
      domain: "example.com",
      canonical_domain: "example.com",
      first_req_description: "Long ".repeat(100),
      first_req_note: "",
    },
    status: "success",
    elapsed_ms: 1200,
    expo_output: {
      ok: true,
      business: { name: "Acme Co", website: "", domain: "", canonicalUrl: "" },
      brand: { colors: [], typography: {}, logoCandidates: [{ url: "https://example.com/logo.png" }] },
      content: { services: [], products: [], contact: {} },
      designIntake: {
        productCategory: "Trade show booth",
        recommendedHeadline: "Acme Co",
        recommendedSupportingText: "We build booths.",
      },
      metadata: {
        source: "scraper_plus_claude",
        pagesInspected: 3,
        claude: { model: "claude-test", attempted: true, status: "success" },
      },
    },
  });

  const { records, parseErrors } = parseExtractionJsonl(`${line}\n{bad`);
  assert.equal(parseErrors.length, 1);
  assert.equal(records.length, 1);

  const row = reviewRowFromExtractionRecord(records[0]!);
  assert.equal(row.ds_number, "DS-1");
  assert.equal(row.extracted_business_name, "Acme Co");
  assert.equal(row.logo_candidate_count, "1");
  assert.equal(row.business_name_score, "");
  assert.ok(row.first_req_description_excerpt.length <= 240);
}

function main(): void {
  testExcerpt();
  testParseAndReviewRow();
  console.log("historicalReviewQueue.test.ts: all checks passed");
}

main();
