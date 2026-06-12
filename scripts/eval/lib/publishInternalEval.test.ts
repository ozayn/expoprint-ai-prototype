#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  buildPublishedInternalEvalFile,
  displayUrlHostOnly,
  sanitizeReviewQueueRecord,
} from "../../../src/lib/evalInternal/sanitizePublishedReview";
import { buildPublishedUrlInventoryFile } from "../../../src/lib/evalInternal/sanitizePublishedUrlInventory";
import { publishedUrlInventoryRowToUrlInventoryRow } from "../../../src/lib/evalInternal/publishedUrlInventory";

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
  assert.equal(row.error_message, "fetch failed for [url]");
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

function testSanitizeContactAndOfferings(): void {
  const row = sanitizeReviewQueueRecord(
    {
      domain: "example.com",
      normalized_url: "https://example.com/page",
      status: "success",
      extracted_emails: '["hello@example.com"]',
      extracted_phone_numbers: '["555-0100"]',
      extracted_products: '["Banners"]',
      extracted_services: '["Printing"]',
      extracted_tagline: "We print",
      elapsed_ms: "4200",
      extraction_provider: "scraper",
      extraction_model: "claude-test",
    },
    0,
    { includeDomains: true, includeLogoUrls: true },
  );

  assert.ok(row.extracted_emails.includes("hello@example.com"));
  assert.ok(row.extracted_products.includes("Banners"));
  assert.equal(row.extracted_tagline, "We print");
  assert.equal(row.elapsed_ms, "4200");
  assert.equal(row.extraction_provider, "scraper");
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

function testPublishedUrlInventoryOmitsPartnerFields(): void {
  const publishedReview = sanitizeReviewQueueRecord(
    {
      domain: "client.com",
      canonical_domain: "client.com",
      normalized_url: "https://client.com/private",
      status: "success",
      extracted_business_name: "Client Co",
      ds_id: "secret",
      project_title: "Secret booth",
    },
    0,
    { includeDomains: true, includeLogoUrls: true },
  );

  const { file, stats } = buildPublishedUrlInventoryFile(
    "url_candidates_20260604201906.csv",
    "review_queue_combined_20260612200905356.csv",
    [
      {
        ds_id: "secret-id",
        ds_number: "DS-1",
        project_id: "proj-1",
        project_title: "Booth graphics",
        project_status: "open",
        project_type: "booth",
        turnaround_type: "",
        shop_code: "shop-1",
        source_column: "first_req_description",
        raw_url: "https://client.com/page",
        normalized_url: "https://client.com/page?q=1",
        domain: "client.com",
        canonical_domain: "client.com",
        first_req_description: "Customer wants a booth",
        first_req_note: "urgent",
      },
      {
        ds_id: "other",
        ds_number: "DS-2",
        project_id: "proj-2",
        project_title: "Other",
        project_status: "open",
        project_type: "outdoor",
        turnaround_type: "",
        shop_code: "shop-2",
        source_column: "website_url",
        raw_url: "https://other.com",
        normalized_url: "https://other.com",
        domain: "other.com",
        canonical_domain: "other.com",
        first_req_description: "",
        first_req_note: "",
      },
    ],
    [publishedReview],
    {
      includeDomains: true,
      includeProjectContext: false,
      includeLogoUrls: true,
    },
  );

  assert.equal(stats.rowsPublished, 2);
  assert.equal(stats.matchedCount, 1);
  assert.equal(stats.notRunCount, 1);
  assert.equal(file.include_domains, true);
  assert.equal(file.rows[0].canonical_domain, "client.com");
  assert.equal(file.rows[0].normalized_url, "https://client.com");
  assert.equal(file.rows[0].review?.extracted_business_name, "Client Co");
  assert.equal(file.rows[0].review?.ds_id, "");
  assert.equal(file.rows[0].project_title, undefined);
  assert.equal(file.rows[1].extraction_status, "not_run");
  assert.equal(file.rows[1].review, null);

  const viewerRow = publishedUrlInventoryRowToUrlInventoryRow(file.rows[0]);
  assert.equal(viewerRow.candidate.ds_id, "");
  assert.equal(viewerRow.extractionStatus, "success");
}

function run(): void {
  testDisplayUrlHostOnly();
  testSanitizeOmitsPartnerFields();
  testSanitizeAnonymizedLabels();
  testSanitizeContactAndOfferings();
  testBuildFile();
  testPublishedUrlInventoryOmitsPartnerFields();
  console.log("publishInternalEval.test.ts: all checks passed");
}

run();
