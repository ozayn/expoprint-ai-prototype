#!/usr/bin/env node
import assert from "node:assert/strict";
import { selectUrlCandidatesWithSummary } from "./selectUrlCandidates.js";
import type { UrlCandidateOutputRow } from "./urlCandidates.js";
import {
  buildProcessedReviewIndex,
  buildProcessedStatusIndex,
} from "./reviewQueueProcessedIndex.js";
import type { ReviewQueueRow } from "./historicalReviewQueue.js";
import { REVIEW_QUEUE_COLUMNS } from "./historicalReviewQueue.js";

function candidate(
  normalizedUrl: string,
  domain: string,
): UrlCandidateOutputRow {
  return {
    ds_id: "1",
    ds_number: "DS-1",
    project_id: "",
    project_title: "T",
    project_status: "",
    project_type: "",
    turnaround_type: "",
    shop_code: "",
    source_column: "first_req_description",
    raw_url: normalizedUrl,
    normalized_url: normalizedUrl,
    domain,
    canonical_domain: domain.replace(/^www\./, ""),
    first_req_description: "",
    first_req_note: "",
  };
}

function reviewRow(
  normalizedUrl: string,
  domain: string,
  status: string,
): ReviewQueueRow {
  const row = {} as ReviewQueueRow;
  for (const col of REVIEW_QUEUE_COLUMNS) {
    row[col] = "";
  }
  row.normalized_url = normalizedUrl;
  row.domain = domain;
  row.canonical_domain = domain.replace(/^www\./, "");
  row.status = status;
  return row;
}

function testDefaultSelectsNotRunOnly(): void {
  const candidates = [
    candidate("https://success.com/", "success.com"),
    candidate("https://failed.com/", "failed.com"),
    candidate("https://new.com/", "new.com"),
  ];
  const index = buildProcessedStatusIndex([
    reviewRow("https://success.com/", "success.com", "success"),
    reviewRow("https://failed.com/", "failed.com", "error"),
  ]);

  const { selected, summary } = selectUrlCandidatesWithSummary(candidates, {
    allowDuplicateDomains: false,
    offset: 0,
    limit: 10,
    processedStatusIndex: index,
  });

  assert.equal(summary?.notRun, 1);
  assert.equal(summary?.alreadySuccessful, 1);
  assert.equal(summary?.alreadyFailed, 1);
  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.domain, "new.com");
}

function testRetryFailedIncludesFailed(): void {
  const candidates = [
    candidate("https://failed.com/", "failed.com"),
    candidate("https://new.com/", "new.com"),
  ];
  const index = buildProcessedStatusIndex([
    reviewRow("https://failed.com/", "failed.com", "error"),
  ]);

  const { selected } = selectUrlCandidatesWithSummary(candidates, {
    allowDuplicateDomains: false,
    offset: 0,
    limit: 10,
    processedStatusIndex: index,
    retryFailed: true,
  });

  assert.equal(selected.length, 2);
}

function testReprocessIncludesSuccessful(): void {
  const candidates = [
    candidate("https://success.com/", "success.com"),
    candidate("https://new.com/", "new.com"),
  ];
  const index = buildProcessedStatusIndex([
    reviewRow("https://success.com/", "success.com", "success"),
  ]);

  const { selected } = selectUrlCandidatesWithSummary(candidates, {
    allowDuplicateDomains: false,
    offset: 0,
    limit: 10,
    processedStatusIndex: index,
    reprocess: true,
  });

  assert.equal(selected.length, 2);
}

function testOffsetWithinNotRunPool(): void {
  const candidates = [
    candidate("https://aaa.com/", "aaa.com"),
    candidate("https://bbb.com/", "bbb.com"),
    candidate("https://ccc.com/", "ccc.com"),
  ];
  const index = buildProcessedStatusIndex([
    reviewRow("https://aaa.com/", "aaa.com", "success"),
  ]);

  const { selected } = selectUrlCandidatesWithSummary(candidates, {
    allowDuplicateDomains: false,
    offset: 1,
    limit: 1,
    processedStatusIndex: index,
  });

  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.domain, "ccc.com");
}

function testPrioritizeRootUrls(): void {
  const candidates = [
    candidate("https://deep.com/file/path?x=1", "deep.com"),
    candidate("https://root.com/", "root.com"),
    candidate("https://shallow.com/about", "shallow.com"),
  ];

  const { selected, summary } = selectUrlCandidatesWithSummary(candidates, {
    allowDuplicateDomains: false,
    offset: 0,
    limit: 2,
    prioritizeRootUrls: true,
  });

  assert.equal(selected[0]?.domain, "root.com");
  assert.equal(selected[1]?.domain, "shallow.com");
  assert.equal(summary?.selectedRoot, 1);
  assert.equal(summary?.selectedShallowPath, 1);
  assert.equal(summary?.selectedDeepPath, 0);
}

function testPreserveOrderDisablesPriority(): void {
  const candidates = [
    candidate("https://deep.com/file/path", "deep.com"),
    candidate("https://root.com/", "root.com"),
  ];

  const { selected } = selectUrlCandidatesWithSummary(candidates, {
    allowDuplicateDomains: false,
    offset: 0,
    limit: 1,
    prioritizeRootUrls: true,
    preserveOrder: true,
  });

  assert.equal(selected[0]?.domain, "deep.com");
}

function testRootOnlySelectsHomepages(): void {
  const candidates = [
    candidate("https://deep.com/file/path", "deep.com"),
    candidate("https://root.com/", "root.com"),
  ];

  const { selected, summary } = selectUrlCandidatesWithSummary(candidates, {
    allowDuplicateDomains: false,
    offset: 0,
    limit: 10,
    rootOnly: true,
  });

  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.domain, "root.com");
  assert.equal(summary?.skippedByRootOnly, 1);
}

function testExampleComRootBeforePage(): void {
  const candidates = [
    candidate("https://example.com/page", "example.com"),
    candidate("https://example.com", "example.com"),
  ];

  const { selected } = selectUrlCandidatesWithSummary(candidates, {
    allowDuplicateDomains: true,
    offset: 0,
    limit: 1,
    prioritizeRootUrls: true,
  });

  assert.equal(selected[0]?.normalized_url, "https://example.com");
}

function successReview(
  normalizedUrl: string,
  domain: string,
  fields: Partial<ReviewQueueRow> = {},
): ReviewQueueRow {
  const row = reviewRow(normalizedUrl, domain, "success");
  for (const [key, value] of Object.entries(fields)) {
    (row as Record<string, string>)[key] = value;
  }
  return row;
}

function testReprocessMissingColorsSkipsSuccessfulWithColors(): void {
  const candidates = [
    candidate("https://with-colors.com/", "with-colors.com"),
    candidate("https://logo-no-colors.com/", "logo-no-colors.com"),
    candidate("https://new.com/", "new.com"),
  ];
  const reviews = [
    successReview("https://with-colors.com/", "with-colors.com", {
      extracted_color_hexes: "#112233",
      logo_candidate_count: "2",
    }),
    successReview("https://logo-no-colors.com/", "logo-no-colors.com", {
      logo_candidate_count: "2",
    }),
  ];
  const index = buildProcessedStatusIndex(reviews);
  const reviewIndex = buildProcessedReviewIndex(reviews);

  const { selected, summary } = selectUrlCandidatesWithSummary(candidates, {
    allowDuplicateDomains: false,
    offset: 0,
    limit: 10,
    processedStatusIndex: index,
    processedReviewIndex: reviewIndex,
    reprocessMissingColors: true,
  });

  assert.equal(summary?.alreadySuccessfulWithColors, 1);
  assert.equal(summary?.successfulMissingColors, 1);
  assert.equal(selected.length, 2);
  assert.ok(
    selected.some((r) => r.domain === "logo-no-colors.com"),
  );
  assert.ok(!selected.some((r) => r.domain === "with-colors.com"));
  assert.equal(summary?.selectedMissingColorReprocess, 1);
}

function testReprocessMissingColorsSkipsSuccessWithoutLogo(): void {
  const candidates = [
    candidate("https://no-logo.com/", "no-logo.com"),
    candidate("https://new.com/", "new.com"),
  ];
  const reviews = [successReview("https://no-logo.com/", "no-logo.com")];
  const index = buildProcessedStatusIndex(reviews);
  const reviewIndex = buildProcessedReviewIndex(reviews);

  const { selected } = selectUrlCandidatesWithSummary(candidates, {
    allowDuplicateDomains: false,
    offset: 0,
    limit: 10,
    processedStatusIndex: index,
    processedReviewIndex: reviewIndex,
    reprocessMissingColors: true,
  });

  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.domain, "new.com");
}

function testReprocessMissingColorsRetryFailedIncludesFailed(): void {
  const candidates = [
    candidate("https://failed.com/", "failed.com"),
    candidate("https://logo-no-colors.com/", "logo-no-colors.com"),
  ];
  const reviews = [
    reviewRow("https://failed.com/", "failed.com", "error"),
    successReview("https://logo-no-colors.com/", "logo-no-colors.com", {
      logo_candidate_count: "1",
    }),
  ];
  const index = buildProcessedStatusIndex(reviews);
  const reviewIndex = buildProcessedReviewIndex(reviews);

  const withoutRetry = selectUrlCandidatesWithSummary(candidates, {
    allowDuplicateDomains: false,
    offset: 0,
    limit: 10,
    processedStatusIndex: index,
    processedReviewIndex: reviewIndex,
    reprocessMissingColors: true,
  });
  assert.equal(withoutRetry.selected.length, 1);
  assert.equal(withoutRetry.selected[0]?.domain, "logo-no-colors.com");

  const withRetry = selectUrlCandidatesWithSummary(candidates, {
    allowDuplicateDomains: false,
    offset: 0,
    limit: 10,
    processedStatusIndex: index,
    processedReviewIndex: reviewIndex,
    reprocessMissingColors: true,
    retryFailed: true,
  });
  assert.equal(withRetry.selected.length, 2);
}

function main(): void {
  testDefaultSelectsNotRunOnly();
  testRetryFailedIncludesFailed();
  testReprocessIncludesSuccessful();
  testOffsetWithinNotRunPool();
  testPrioritizeRootUrls();
  testPreserveOrderDisablesPriority();
  testRootOnlySelectsHomepages();
  testExampleComRootBeforePage();
  testReprocessMissingColorsSkipsSuccessfulWithColors();
  testReprocessMissingColorsSkipsSuccessWithoutLogo();
  testReprocessMissingColorsRetryFailedIncludesFailed();
  console.log("selectUrlCandidates.test.ts: all checks passed");
}

main();
