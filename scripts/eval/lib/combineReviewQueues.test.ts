#!/usr/bin/env node
import assert from "node:assert/strict";
import { emptyBrandAuditRow } from "../../../src/lib/evalLocal/brandAuditRow.js";
import {
  combinedReviewQueueToCsv,
  mergeCombinedReviewRows,
  type CombinedReviewQueueRow,
} from "./combineReviewQueues.js";
import { csvRowsToObjects, parseCsv } from "./parseCsv.js";

function reviewRow(
  overrides: Partial<ReturnType<typeof emptyBrandAuditRow>>,
): ReturnType<typeof emptyBrandAuditRow> {
  return { ...emptyBrandAuditRow(), ...overrides };
}

function combinedRow(
  overrides: Partial<ReturnType<typeof emptyBrandAuditRow>>,
  sourceReviewQueue: string,
): CombinedReviewQueueRow {
  const row = reviewRow(overrides);
  return {
    ...row,
    source_review_queue: sourceReviewQueue,
    latest_rerun_status: row.status?.trim() || "",
    latest_rerun_timestamp: overrides.processed_at?.trim() || "",
    preserved_previous_success: "",
    preserved_richer_contact: "",
  };
}

function testMergePreservesSuccessOnRerunFailure(): void {
  const existing = combinedRow(
    {
      normalized_url: "https://example.com/",
      domain: "example.com",
      canonical_domain: "example.com",
      status: "success",
      extracted_business_name: "Kept Co",
      processed_at: "2026-06-01T00:00:00.000Z",
      extraction_run_id: "20260601000000000",
    },
    "review_queue_20260601000000000.csv",
  );
  const incoming = combinedRow(
    {
      normalized_url: "https://example.com/",
      domain: "example.com",
      canonical_domain: "example.com",
      status: "fetch_error",
      error_message: "timeout",
      processed_at: "2026-06-22T00:00:00.000Z",
      extraction_run_id: "20260622000000000",
    },
    "review_queue_20260622000000000.csv",
  );

  const merged = mergeCombinedReviewRows(existing, incoming);
  assert.equal(merged.status, "success");
  assert.equal(merged.extracted_business_name, "Kept Co");
  assert.equal(merged.latest_rerun_status, "fetch_error");
  assert.equal(merged.preserved_previous_success, "true");
}

function testMergeKeepsNewerSuccess(): void {
  const existing = combinedRow(
    {
      normalized_url: "https://example.com/",
      domain: "example.com",
      canonical_domain: "example.com",
      status: "success",
      extracted_business_name: "Old",
      processed_at: "2026-06-01T00:00:00.000Z",
      extraction_run_id: "20260601000000000",
    },
    "review_queue_20260601000000000.csv",
  );
  const incoming = combinedRow(
    {
      normalized_url: "https://example.com/",
      domain: "example.com",
      canonical_domain: "example.com",
      status: "success",
      extracted_business_name: "New",
      processed_at: "2026-06-22T00:00:00.000Z",
      extraction_run_id: "20260622000000000",
    },
    "review_queue_20260622000000000.csv",
  );

  const merged = mergeCombinedReviewRows(existing, incoming);
  assert.equal(merged.status, "success");
  assert.equal(merged.extracted_business_name, "New");
  assert.equal(merged.latest_rerun_status, "success");
  assert.equal(merged.preserved_previous_success, "");
}

function testMergePreservesRicherContactOnRerunSuccess(): void {
  const existing = combinedRow(
    {
      normalized_url: "https://example.com/",
      domain: "example.com",
      canonical_domain: "example.com",
      status: "success",
      extracted_emails: "hello@example.com",
      extracted_color_hexes: '["#f4ece2"]',
      extracted_social_links:
        '[{"label":"Instagram","url":"https://www.instagram.com/example"}]',
      processed_at: "2026-06-01T00:00:00.000Z",
      extraction_run_id: "20260601000000000",
    },
    "review_queue_20260601000000000.csv",
  );
  const incoming = combinedRow(
    {
      normalized_url: "https://example.com/",
      domain: "example.com",
      canonical_domain: "example.com",
      status: "success",
      extracted_emails: "hello@example.com",
      extracted_color_hexes: '["#f4ece2","#1d1a13"]',
      processed_at: "2026-06-22T00:00:00.000Z",
      extraction_run_id: "20260622000000000",
    },
    "review_queue_20260622000000000.csv",
  );

  const merged = mergeCombinedReviewRows(existing, incoming);
  assert.ok(merged.extracted_social_links.includes("instagram.com"));
  assert.equal(merged.preserved_richer_contact, "true");
  assert.equal(merged.latest_rerun_status, "success");
}

function testCombinedCsvIncludesMergeMetadataColumns(): void {
  const rows: CombinedReviewQueueRow[] = [
    mergeCombinedReviewRows(
      combinedRow(
        {
          domain: "example.com",
          canonical_domain: "example.com",
          normalized_url: "https://example.com/",
          status: "success",
          processed_at: "2026-06-01T00:00:00.000Z",
        },
        "review_queue_20260601000000000.csv",
      ),
      combinedRow(
        {
          domain: "example.com",
          canonical_domain: "example.com",
          normalized_url: "https://example.com/",
          status: "fetch_error",
          processed_at: "2026-06-22T00:00:00.000Z",
        },
        "review_queue_20260622000000000.csv",
      ),
    ),
  ];

  const csv = combinedReviewQueueToCsv(rows);
  assert.ok(csv.includes("latest_rerun_status"));
  assert.ok(csv.includes("preserved_previous_success"));
  assert.ok(csv.includes("preserved_richer_contact"));

  const { records } = csvRowsToObjects(parseCsv(csv));
  assert.equal(records[0]?.latest_rerun_status, "fetch_error");
  assert.equal(records[0]?.preserved_previous_success, "true");
}

function main(): void {
  testMergePreservesSuccessOnRerunFailure();
  testMergeKeepsNewerSuccess();
  testMergePreservesRicherContactOnRerunSuccess();
  testCombinedCsvIncludesMergeMetadataColumns();
  console.log("combineReviewQueues.test.ts: all checks passed");
}

main();
