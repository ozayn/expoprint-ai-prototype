#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  classifyScoreValue,
  summarizeReviewQueueRows,
} from "./reviewScoreSummary.js";

function testClassifyScoreValue(): void {
  assert.equal(classifyScoreValue(""), "blank");
  assert.equal(classifyScoreValue("  "), "blank");
  assert.equal(classifyScoreValue("2"), "2");
  assert.equal(classifyScoreValue("n/a"), "N/A");
  assert.equal(classifyScoreValue("N/A"), "N/A");
  assert.equal(classifyScoreValue("4"), "invalid");
  assert.equal(classifyScoreValue("yes"), "invalid");
}

function testSummarizeReviewQueueRows(): void {
  const summary = summarizeReviewQueueRows("data/eval/results/review_queue_test.csv", [
    {
      status: "success",
      business_name_score: "3",
      category_score: "2",
      logo_score: "N/A",
      brief_score: "1",
      overall_score: "2",
      reviewer_notes: "good logo",
    },
    {
      status: "fetch_error",
      business_name_score: "0",
      category_score: "",
      logo_score: "1",
      brief_score: "bad",
      overall_score: "",
      reviewer_notes: "good logo",
    },
    {
      status: "success",
      business_name_score: "2",
      category_score: "3",
      logo_score: "2",
      brief_score: "2",
      overall_score: "3",
      reviewer_notes: "",
    },
  ]);

  assert.equal(summary.totalRows, 3);
  assert.equal(summary.rowsWithOverallScore, 2);
  assert.equal(summary.rowsMissingOverallScore, 1);
  assert.equal(summary.successExtractionCount, 2);
  assert.equal(summary.failedExtractionCount, 1);
  assert.equal(summary.reviewerNotesNonEmptyCount, 2);
  assert.equal(summary.topReviewerNotes[0]?.note, "good logo");
  assert.equal(summary.topReviewerNotes[0]?.count, 2);

  const overall = summary.scoreColumns.find((c) => c.column === "overall_score");
  assert.ok(overall);
  assert.equal(overall.average, 2.5);
  assert.equal(overall.distribution["2"], 1);
  assert.equal(overall.distribution["3"], 1);
  assert.equal(overall.distribution.blank, 1);

  const brief = summary.scoreColumns.find((c) => c.column === "brief_score");
  assert.ok(brief);
  assert.equal(brief.distribution.invalid, 1);
  assert.equal(summary.invalidScoreWarnings.length, 1);
}

function main(): void {
  testClassifyScoreValue();
  testSummarizeReviewQueueRows();
  console.log("reviewScoreSummary.test.ts: all checks passed");
}

main();
