#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  parseMissingContactFilter,
  reviewRowMatchesMissingContactFilter,
  countMissingContactOnSuccessfulRows,
} from "./missingContactSelection.js";
import type { ReviewQueueRow } from "./historicalReviewQueue.js";
import { REVIEW_QUEUE_COLUMNS } from "./historicalReviewQueue.js";

function emptyRow(status: string): ReviewQueueRow {
  const row = {} as ReviewQueueRow;
  for (const col of REVIEW_QUEUE_COLUMNS) row[col] = "";
  row.status = status;
  return row;
}

function testParseMissingContactFilter(): void {
  assert.deepEqual(parseMissingContactFilter(["--missing-contact"]), {
    fields: ["email", "phone", "address", "social"],
  });
  assert.deepEqual(parseMissingContactFilter(["--missing-email"]), {
    fields: ["email"],
  });
  assert.deepEqual(
    parseMissingContactFilter(["--missing-contact", "--missing-email"]),
    { fields: ["email"] },
  );
  assert.equal(parseMissingContactFilter([]), null);
}

function testReviewRowMatchesFilter(): void {
  const row = emptyRow("success");
  row.extracted_phone_numbers = "555-0100";
  assert.equal(
    reviewRowMatchesMissingContactFilter(row, {
      fields: ["email", "phone", "address", "social"],
    }),
    true,
  );
  assert.equal(
    reviewRowMatchesMissingContactFilter(row, { fields: ["phone"] }),
    false,
  );
}

function testCountMissingContact(): void {
  const rows = [
    emptyRow("success"),
    emptyRow("success"),
    emptyRow("error"),
  ];
  rows[0].extracted_emails = "a@b.com";
  rows[0].extracted_phone_numbers = "555-0100";
  rows[0].extracted_addresses = "addr";
  rows[0].extracted_social_links = '[{"url":"https://x.com/a"}]';

  const counts = countMissingContactOnSuccessfulRows(rows);
  assert.equal(counts.any, 1);
  assert.equal(counts.email, 1);
}

function main(): void {
  testParseMissingContactFilter();
  testReviewRowMatchesFilter();
  testCountMissingContact();
  console.log("missingContactSelection.test.ts: all checks passed");
}

main();
