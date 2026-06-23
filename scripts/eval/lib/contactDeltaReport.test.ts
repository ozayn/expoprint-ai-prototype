#!/usr/bin/env node
import assert from "node:assert/strict";
import { emptyBrandAuditRow } from "../../../src/lib/evalLocal/brandAuditRow.js";
import {
  buildContactDeltaReport,
  compareContactFields,
} from "./contactDeltaReport.js";

function reviewRow(
  overrides: Partial<ReturnType<typeof emptyBrandAuditRow>>,
): ReturnType<typeof emptyBrandAuditRow> {
  return { ...emptyBrandAuditRow(), ...overrides };
}

function testOldSuccessNewSuccessKeepsNewContact(): void {
  const before = reviewRow({
    normalized_url: "https://example.com/",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    extracted_emails: "",
    extracted_phone_numbers: "555-0100",
  });
  const after = reviewRow({
    normalized_url: "https://example.com/",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    extracted_emails: "hello@example.com",
    extracted_phone_numbers: "555-0100",
  });

  const delta = compareContactFields(before, after);
  assert.deepEqual(delta.newlyFilled, ["email"]);
  assert.deepEqual(delta.lost, []);

  const report = buildContactDeltaReport({
    latestBatchFilename: "review_queue_test.csv",
    latestBatchRows: [after],
    baselineRows: [before],
    baselineSource: "pre_rerun_combined",
    baselineLabel: "test",
  });
  assert.equal(report.emailNewlyFilled, 1);
  assert.equal(report.anyContactNewlyFilled, 1);
  assert.equal(report.rowsLostFields, 0);
}

function testOldSuccessNewFailurePreservesBaselineContact(): void {
  const before = reviewRow({
    normalized_url: "https://example.com/",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    extracted_emails: "keep@example.com",
  });
  const rerun = reviewRow({
    normalized_url: "https://example.com/",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "fetch_error",
    error_message: "timeout",
  });

  const report = buildContactDeltaReport({
    latestBatchFilename: "review_queue_test.csv",
    latestBatchRows: [rerun],
    baselineRows: [before],
    baselineSource: "pre_rerun_combined",
    baselineLabel: "test",
  });
  assert.equal(report.rerunFailures, 1);
  assert.equal(report.previousSuccessfulRowsFound, 1);
  assert.equal(report.emailNewlyFilled, 0);
  assert.equal(report.rowsUnchanged, 1);
  assert.equal(report.rowsLostFields, 0);
}

function testOldFailureNewSuccessFillsContact(): void {
  const before = reviewRow({
    normalized_url: "https://example.com/",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "error",
  });
  const after = reviewRow({
    normalized_url: "https://example.com/",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    extracted_phone_numbers: "555-0200",
  });

  const report = buildContactDeltaReport({
    latestBatchFilename: "review_queue_test.csv",
    latestBatchRows: [after],
    baselineRows: [before],
    baselineSource: "pre_rerun_combined",
    baselineLabel: "test",
  });
  assert.equal(report.phoneNewlyFilled, 1);
  assert.equal(report.previousSuccessfulRowsFound, 0);
}

function testRegressionWhenRerunSuccessLosesField(): void {
  const before = reviewRow({
    normalized_url: "https://example.com/",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    extracted_emails: "before@example.com",
    extracted_phone_numbers: "555-0100",
  });
  const after = reviewRow({
    normalized_url: "https://example.com/",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    extracted_phone_numbers: "555-0100",
  });

  const report = buildContactDeltaReport({
    latestBatchFilename: "review_queue_test.csv",
    latestBatchRows: [after],
    baselineRows: [before],
    baselineSource: "pre_rerun_combined",
    baselineLabel: "test",
  });
  assert.equal(report.rowsLostFields, 1);
  assert.equal(report.examplesRegressed.length, 1);
  assert.deepEqual(report.examplesRegressed[0]?.lost, ["email"]);
}

function main(): void {
  testOldSuccessNewSuccessKeepsNewContact();
  testOldSuccessNewFailurePreservesBaselineContact();
  testOldFailureNewSuccessFillsContact();
  testRegressionWhenRerunSuccessLosesField();
  console.log("contactDeltaReport.test.ts: all checks passed");
}

main();
