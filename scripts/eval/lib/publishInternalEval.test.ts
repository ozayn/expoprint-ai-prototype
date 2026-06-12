#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  buildPublishedInternalEvalFile,
  displayUrlHostOnly,
  sanitizeReviewQueueRecord,
} from "../../../src/lib/evalInternal/sanitizePublishedReview";

function testDisplayUrlHostOnly(): void {
  assert.equal(
    displayUrlHostOnly("https://Example.COM/booth?ref=1#top"),
    "https://example.com",
  );
  assert.equal(displayUrlHostOnly("www.shop.example.net/path"), "https://shop.example.net");
}

function testSanitizeOmitsPartnerFields(): void {
  const row = sanitizeReviewQueueRecord(
    {
      ds_id: "secret-id",
      ds_number: "DS-999",
      project_title: "Secret project",
      shop_code: "shop-1",
      normalized_url: "https://client.com/private/page?q=1",
      domain: "client.com",
      canonical_domain: "client.com",
      first_req_description_excerpt: "Customer asked for booth",
      first_req_note_excerpt: "urgent",
      extracted_business_name: "Client Co",
      extracted_business_category: "Trade show booth",
      extracted_summary: "Booth graphics",
      logo_candidate_count: "2",
      selected_logo_url: "https://client.com/logo.png",
      logo_candidate_urls:
        '[{"url":"https://client.com/logo.png","source":"header"},{"url":"https://client.com/fav.ico"}]',
      extracted_color_hexes: '["#111111"]',
      primary_color_hex: "#111111",
      status: "success",
      pages_inspected: "3",
      error_message: "fetch failed for https://client.com/secret",
      extraction_provider: "scraper",
      extraction_model: "claude",
    },
    0,
    { includeDomains: true, includeLogoUrls: true },
  );

  assert.equal(row.ds_id, "");
  assert.equal(row.ds_number, "");
  assert.equal(row.project_title, "");
  assert.equal(row.shop_code, "");
  assert.equal(row.first_req_description_excerpt, "");
  assert.equal(row.error_message, "");
  assert.equal(row.normalized_url, "https://client.com");
  assert.equal(row.extracted_business_name, "Client Co");
  assert.ok(row.logo_candidate_urls.includes("client.com/logo.png"));
  const logos = JSON.parse(row.logo_candidate_urls) as unknown[];
  assert.ok(logos.length <= 3);
}

function testSanitizeAnonymizedLabels(): void {
  const row = sanitizeReviewQueueRecord(
    {
      normalized_url: "https://hidden.com/page",
      domain: "hidden.com",
      status: "success",
    },
    2,
    { includeDomains: false, includeLogoUrls: false },
  );

  assert.equal(row.domain, "Site 3");
  assert.equal(row.normalized_url, "");
  assert.equal(row.canonical_domain, "");
}

function testBuildFile(): void {
  const { file, stats } = buildPublishedInternalEvalFile(
    "review_queue_20260605212708.csv",
    [{ status: "success", domain: "example.com", normalized_url: "https://example.com/" }],
    { includeDomains: true, includeLogoUrls: true },
  );

  assert.equal(stats.rowsPublished, 1);
  assert.equal(file.source_review_queue, "review_queue_20260605212708.csv");
  assert.equal(file.include_domains, true);
  assert.equal(file.rows.length, 1);
}

function run(): void {
  testDisplayUrlHostOnly();
  testSanitizeOmitsPartnerFields();
  testSanitizeAnonymizedLabels();
  testBuildFile();
  console.log("publishInternalEval.test.ts: all checks passed");
}

run();
