#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  dedupeBrandAuditRows,
  mergeBrandAuditRows,
  parseDuplicateVariants,
  pickBetterReviewRow,
} from "../../../src/lib/evalLocal/evalCanonicalDedup.js";
import {
  dedupeUrlInventoryRows,
  type UrlInventoryRow,
} from "../../../src/lib/evalLocal/urlInventoryJoin.js";
import { emptyBrandAuditRow } from "../../../src/lib/evalLocal/brandAuditRow.js";
import type { UrlCandidateRow } from "../../../src/lib/evalLocal/urlCandidateTypes.js";

function emptyCandidate(): UrlCandidateRow {
  return {
    ds_number: "",
    ds_id: "",
    project_title: "",
    project_type: "",
    shop_code: "",
    source_column: "",
    raw_url: "",
    normalized_url: "",
    domain: "",
    canonical_domain: "",
    first_req_description: "",
    first_req_note: "",
  };
}

function reviewRow(
  overrides: Partial<ReturnType<typeof emptyBrandAuditRow>>,
): ReturnType<typeof emptyBrandAuditRow> {
  return { ...emptyBrandAuditRow(), ...overrides };
}

function testWwwNonWwwCollapse(): void {
  const www = reviewRow({
    normalized_url: "https://www.bernaco.com",
    domain: "www.bernaco.com",
    canonical_domain: "bernaco.com",
    status: "success",
    extracted_business_name: "Bernaco",
    processed_at: "2026-06-01T00:00:00.000Z",
    source_review_queue: "review_queue_20260601000000000.csv",
  });
  const bare = reviewRow({
    normalized_url: "https://bernaco.com",
    domain: "bernaco.com",
    canonical_domain: "bernaco.com",
    status: "",
  });

  const deduped = dedupeBrandAuditRows([www, bare]);
  assert.equal(deduped.afterCount, 1);
  assert.equal(deduped.duplicatesRemoved, 1);
  const variants = parseDuplicateVariants(
    deduped.items[0]?.duplicate_source_urls,
  );
  assert.equal(variants.length, 1);
  assert.equal(variants[0]?.normalized_url, "https://bernaco.com");
}

function testProcessedBeatsNotRun(): void {
  const processed = reviewRow({
    normalized_url: "https://example.com",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    extracted_business_name: "Example Co",
  });
  const notRun = reviewRow({
    normalized_url: "https://www.example.com",
    domain: "www.example.com",
    canonical_domain: "example.com",
    status: "",
  });

  const kept = pickBetterReviewRow(notRun, processed);
  assert.equal(kept.status, "success");
}

function testSuccessBeatsFailed(): void {
  const success = reviewRow({
    normalized_url: "https://example.com",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
  });
  const failed = reviewRow({
    normalized_url: "https://www.example.com",
    domain: "www.example.com",
    canonical_domain: "example.com",
    status: "error",
    error_message: "timeout",
  });

  const kept = pickBetterReviewRow(failed, success);
  assert.equal(kept.status, "success");
}

function testNewerProcessedBeatsOlder(): void {
  const older = reviewRow({
    normalized_url: "https://example.com",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    processed_at: "2026-06-01T00:00:00.000Z",
    source_review_queue: "review_queue_20260601000000000.csv",
    extracted_business_name: "Old",
  });
  const newer = reviewRow({
    normalized_url: "https://www.example.com",
    domain: "www.example.com",
    canonical_domain: "example.com",
    status: "success",
    processed_at: "2026-06-10T00:00:00.000Z",
    source_review_queue: "review_queue_20260610000000000.csv",
    extracted_business_name: "New",
  });

  const kept = pickBetterReviewRow(older, newer);
  assert.equal(kept.extracted_business_name, "New");
}

function testDuplicateVariantsPreservedInMerge(): void {
  const primary = reviewRow({
    normalized_url: "https://bernaco.com",
    domain: "bernaco.com",
    canonical_domain: "bernaco.com",
    status: "success",
  });
  const secondary = reviewRow({
    normalized_url: "https://www.bernaco.com",
    domain: "www.bernaco.com",
    canonical_domain: "bernaco.com",
    status: "",
  });

  const merged = mergeBrandAuditRows(primary, secondary);
  const variants = parseDuplicateVariants(merged.duplicate_source_urls);
  assert.equal(variants.length, 1);
  assert.equal(variants[0]?.domain, "www.bernaco.com");
}

function testInventoryCanonicalDedupe(): void {
  const rows: UrlInventoryRow[] = [
    {
      candidate: {
        ...emptyCandidate(),
        normalized_url: "https://www.bernaco.com",
        domain: "www.bernaco.com",
        canonical_domain: "bernaco.com",
      },
      extractionStatus: "not_run",
      review: null,
      originalIndex: 0,
      processedMeta: null,
    },
    {
      candidate: {
        ...emptyCandidate(),
        normalized_url: "https://bernaco.com",
        domain: "bernaco.com",
        canonical_domain: "bernaco.com",
      },
      extractionStatus: "success",
      review: reviewRow({
        normalized_url: "https://bernaco.com",
        domain: "bernaco.com",
        canonical_domain: "bernaco.com",
        status: "success",
      }),
      originalIndex: 1,
      processedMeta: null,
    },
  ];

  const deduped = dedupeUrlInventoryRows(rows, undefined, 2);
  assert.equal(deduped.rows.length, 1);
  assert.equal(deduped.stats.totalRawCandidates, 2);
  assert.equal(deduped.stats.hiddenDuplicateVariants, 1);
  assert.equal(deduped.rows[0]?.extractionStatus, "success");
  assert.equal(deduped.rows[0]?.duplicateVariants?.length, 1);
}

function testNewerFailureDoesNotBeatOlderSuccess(): void {
  const olderSuccess = reviewRow({
    normalized_url: "https://example.com",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    extracted_business_name: "Kept Co",
    processed_at: "2026-06-01T00:00:00.000Z",
    source_review_queue: "review_queue_20260601000000000.csv",
    extraction_run_id: "20260601000000000",
  });
  const newerFailure = reviewRow({
    normalized_url: "https://example.com",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "fetch_error",
    error_message: "timeout",
    processed_at: "2026-06-22T00:00:00.000Z",
    source_review_queue: "review_queue_20260622000000000.csv",
    extraction_run_id: "20260622000000000",
  });

  const kept = pickBetterReviewRow(newerFailure, olderSuccess);
  assert.equal(kept.status, "success");
  assert.equal(kept.extracted_business_name, "Kept Co");
}

function testNewerSuccessBeatsOlderFailure(): void {
  const olderFailure = reviewRow({
    normalized_url: "https://example.com",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "error",
    processed_at: "2026-06-01T00:00:00.000Z",
    source_review_queue: "review_queue_20260601000000000.csv",
  });
  const newerSuccess = reviewRow({
    normalized_url: "https://example.com",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    extracted_business_name: "Recovered",
    processed_at: "2026-06-22T00:00:00.000Z",
    source_review_queue: "review_queue_20260622000000000.csv",
  });

  const kept = pickBetterReviewRow(olderFailure, newerSuccess);
  assert.equal(kept.status, "success");
  assert.equal(kept.extracted_business_name, "Recovered");
}

function testLatestFailureWinsWhenOnlyFailures(): void {
  const olderFailure = reviewRow({
    normalized_url: "https://example.com",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "error",
    error_message: "old",
    processed_at: "2026-06-01T00:00:00.000Z",
    source_review_queue: "review_queue_20260601000000000.csv",
  });
  const newerFailure = reviewRow({
    normalized_url: "https://example.com",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "fetch_error",
    error_message: "new",
    processed_at: "2026-06-22T00:00:00.000Z",
    source_review_queue: "review_queue_20260622000000000.csv",
  });

  const kept = pickBetterReviewRow(olderFailure, newerFailure);
  assert.equal(kept.status, "fetch_error");
  assert.equal(kept.error_message, "new");
}

function testMergePreservesDsNumberFromOlderWhenNewerEmpty(): void {
  const older = reviewRow({
    normalized_url: "https://example.com",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    ds_number: "15607",
    processed_at: "2026-06-01T00:00:00.000Z",
    source_review_queue: "review_queue_20260601000000000.csv",
  });
  const newer = reviewRow({
    normalized_url: "https://example.com",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "fetch_error",
    ds_number: "",
    error_message: "timeout",
    processed_at: "2026-06-22T00:00:00.000Z",
    source_review_queue: "review_queue_20260622000000000.csv",
  });

  const kept = pickBetterReviewRow(newer, older);
  const merged = mergeBrandAuditRows(kept, older.status === kept.status ? newer : older);
  assert.equal(merged.ds_number, "15607");
}

function testMergePreservesDsNumberWhenNewerHasRicherContact(): void {
  const older = reviewRow({
    normalized_url: "https://example.com",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    ds_number: "15607",
    extracted_emails: "hello@example.com",
    processed_at: "2026-06-01T00:00:00.000Z",
    source_review_queue: "review_queue_20260601000000000.csv",
  });
  const newer = reviewRow({
    normalized_url: "https://example.com",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    ds_number: "",
    extracted_emails: "hello@example.com",
    extracted_phone_numbers: '["555-0100"]',
    processed_at: "2026-06-22T00:00:00.000Z",
    source_review_queue: "review_queue_20260622000000000.csv",
  });

  const kept = pickBetterReviewRow(older, newer);
  const merged = mergeBrandAuditRows(kept, kept === older ? newer : older);
  assert.equal(merged.ds_number, "15607");
  assert.ok(merged.extracted_phone_numbers.includes("555-0100"));
}

function main(): void {
  testWwwNonWwwCollapse();
  testProcessedBeatsNotRun();
  testSuccessBeatsFailed();
  testNewerProcessedBeatsOlder();
  testNewerFailureDoesNotBeatOlderSuccess();
  testNewerSuccessBeatsOlderFailure();
  testLatestFailureWinsWhenOnlyFailures();
  testMergePreservesDsNumberFromOlderWhenNewerEmpty();
  testMergePreservesDsNumberWhenNewerHasRicherContact();
  testDuplicateVariantsPreservedInMerge();
  testInventoryCanonicalDedupe();
  console.log("evalCanonicalDedup.test.ts: all checks passed");
}

main();
