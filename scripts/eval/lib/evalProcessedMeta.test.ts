#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  evalRunIdToIso,
  extractionRunIdFromReviewQueueName,
  formatProcessedLabel,
  isLatestBatchSourceReviewQueue,
  newestSourceReviewQueueFromSources,
  processedMetaFromReviewRow,
} from "../../../src/lib/evalLocal/evalProcessedMeta.js";
import { emptyBrandAuditRow } from "../../../src/lib/evalLocal/brandAuditRow.js";
import {
  parseUrlInventorySortMode,
  sortUrlInventoryRows,
} from "../../../src/lib/evalLocal/urlInventorySort.js";
import type { UrlInventoryRow } from "../../../src/lib/evalLocal/urlInventoryJoin.js";

function testEvalRunIdToIso(): void {
  const iso = evalRunIdToIso("20260612111109596");
  assert.ok(iso?.startsWith("2026-06-12"));
}

function testProcessedMetaFromReviewRow(): void {
  const row = emptyBrandAuditRow();
  row.source_review_queue = "review_queue_20260612111109596.csv";
  const newest = newestSourceReviewQueueFromSources([
    "review_queue_20260601000000000.csv",
    "review_queue_20260612111109596.csv",
  ]);
  const meta = processedMetaFromReviewRow(row, {
    newestSourceReviewQueue: newest,
  });
  assert.equal(meta?.extractionRunId, "20260612111109596");
  assert.equal(meta?.isLatestBatch, true);
}

function testLatestBatchOnlyForNewestQueue(): void {
  const newest = newestSourceReviewQueueFromSources([
    "review_queue_20260601000000000.csv",
    "review_queue_20260605000000000.csv",
    "review_queue_20260605000000000.csv",
  ]);
  assert.equal(newest, "review_queue_20260605000000000.csv");

  assert.equal(
    isLatestBatchSourceReviewQueue(
      "review_queue_20260601000000000.csv",
      newest,
    ),
    false,
  );
  assert.equal(
    isLatestBatchSourceReviewQueue(
      "review_queue_20260605000000000.csv",
      newest,
    ),
    true,
  );
  assert.equal(
    isLatestBatchSourceReviewQueue(
      "review_queue_combined_20260605000000000.csv",
      newest,
    ),
    false,
  );

  const older = emptyBrandAuditRow();
  older.source_review_queue = "review_queue_20260601000000000.csv";
  const newer = emptyBrandAuditRow();
  newer.source_review_queue = "review_queue_20260605000000000.csv";

  const olderMeta = processedMetaFromReviewRow(older, {
    newestSourceReviewQueue: newest,
  });
  const newerMeta = processedMetaFromReviewRow(newer, {
    newestSourceReviewQueue: newest,
  });

  assert.equal(olderMeta?.isLatestBatch, false);
  assert.equal(newerMeta?.isLatestBatch, true);
  assert.equal(
    formatProcessedLabel(olderMeta?.processedAt ?? "", false)?.startsWith(
      "Processed",
    ),
    true,
  );
}

function testSortRecentFirst(): void {
  const makeRow = (
    index: number,
    status: UrlInventoryRow["extractionStatus"],
    processedAt: string,
  ): UrlInventoryRow => ({
    candidate: {
      ds_id: "",
      ds_number: "",
      project_id: "",
      project_title: "",
      project_status: "",
      project_type: "",
      turnaround_type: "",
      shop_code: "",
      source_column: "",
      raw_url: "",
      normalized_url: `https://site-${index}.example`,
      domain: `site-${index}.example`,
      canonical_domain: `site-${index}.example`,
      first_req_description: "",
      first_req_note: "",
    },
    extractionStatus: status,
    review: null,
    originalIndex: index,
    processedMeta: processedAt
      ? {
          sourceReviewQueue: "review_queue_test.csv",
          extractionRunId: "20260612111109596",
          processedAt,
          isLatestBatch: false,
        }
      : null,
  });

  const rows = [
    makeRow(0, "not_run", ""),
    makeRow(1, "success", "2026-06-10T12:00:00.000Z"),
    makeRow(2, "success", "2026-06-12T12:00:00.000Z"),
  ];

  const sorted = sortUrlInventoryRows(rows, parseUrlInventorySortMode("recent"));
  assert.equal(sorted[0].originalIndex, 2);
  assert.equal(sorted[1].originalIndex, 1);
  assert.equal(sorted[2].originalIndex, 0);
}

function main(): void {
  testEvalRunIdToIso();
  testProcessedMetaFromReviewRow();
  testLatestBatchOnlyForNewestQueue();
  testSortRecentFirst();
  assert.equal(
    formatProcessedLabel("2026-06-18T12:00:00.000Z", false)?.startsWith(
      "Processed",
    ),
    true,
  );
  assert.equal(
    extractionRunIdFromReviewQueueName("review_queue_20260612111109596.csv"),
    "20260612111109596",
  );
  console.log("evalProcessedMeta.test.ts: all checks passed");
}

main();
