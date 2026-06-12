#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  hrefForReviewRow,
  safeHttpHref,
} from "../../../src/lib/evalLocal/evalRowUrl";
import type { ReviewQueueRow } from "../../../src/lib/evalLocal/reviewQueueTypes";

function emptyRow(): ReviewQueueRow {
  return {
    ds_number: "",
    ds_id: "",
    project_title: "",
    project_type: "",
    shop_code: "",
    normalized_url: "",
    domain: "",
    canonical_domain: "",
    source_column: "",
    first_req_description_excerpt: "",
    first_req_note_excerpt: "",
    status: "",
    elapsed_ms: "",
    error_message: "",
    extracted_business_name: "",
    extracted_business_category: "",
    extracted_tagline: "",
    extracted_summary: "",
    extracted_emails: "",
    extracted_phone_numbers: "",
    extracted_social_links: "",
    extracted_addresses: "",
    extracted_contact_links: "",
    logo_candidate_count: "",
    selected_logo_url: "",
    logo_candidate_urls: "",
    extracted_color_hexes: "",
    primary_color_hex: "",
    secondary_color_hex: "",
    pages_inspected: "",
    extraction_provider: "",
    extraction_model: "",
    business_name_score: "",
    category_score: "",
    logo_score: "",
    brief_score: "",
    overall_score: "",
    reviewer_notes: "",
    business_name_similarity_hint: "",
    title_business_name_overlap_hint: "",
  };
}

function testSafeHttpHref(): void {
  assert.equal(
    safeHttpHref("https://example.com/path?q=1"),
    "https://example.com/path?q=1",
  );
  assert.equal(safeHttpHref("javascript:alert(1)"), null);
  assert.equal(safeHttpHref("data:text/html,hi"), null);
  assert.equal(safeHttpHref(""), null);
}

function testHrefForReviewRow(): void {
  const withUrl = emptyRow();
  withUrl.normalized_url = "https://client.com/private/page";
  assert.equal(
    hrefForReviewRow(withUrl),
    "https://client.com/private/page",
  );

  const domainOnly = emptyRow();
  domainOnly.domain = "example.com";
  assert.equal(hrefForReviewRow(domainOnly), "https://example.com/");

  const anonymized = emptyRow();
  anonymized.domain = "Site 1";
  assert.equal(hrefForReviewRow(anonymized), null);
}

function run(): void {
  testSafeHttpHref();
  testHrefForReviewRow();
  console.log("evalRowUrl.test.ts: all checks passed");
}

run();
