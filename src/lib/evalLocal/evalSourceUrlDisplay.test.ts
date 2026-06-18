import assert from "node:assert/strict";
import {
  parseSourceUrlDisplay,
  parseSourceUrlDisplayFromCandidate,
  parseSourceUrlDisplayFromReviewRow,
} from "./evalSourceUrlDisplay.js";
import { emptyBrandAuditRow } from "./brandAuditRow.js";

function testHostAndPath() {
  const display = parseSourceUrlDisplay(
    "https://drive.google.com/file/d/abc123/view?usp=sharing",
    "drive.google.com",
  );
  assert.equal(display.host, "drive.google.com");
  assert.equal(display.pathSuffix, "/file/d/abc123/view?usp=sharing");
  assert.equal(
    display.href,
    "https://drive.google.com/file/d/abc123/view?usp=sharing",
  );
}

function testDomainOnly() {
  const display = parseSourceUrlDisplay(
    "https://stripe.com/",
    "stripe.com",
  );
  assert.equal(display.host, "stripe.com");
  assert.equal(display.pathSuffix, null);
}

function testReviewRow() {
  const row = emptyBrandAuditRow();
  row.normalized_url =
    "https://drive.google.com/file/d/xyz/view";
  row.domain = "drive.google.com";
  const display = parseSourceUrlDisplayFromReviewRow(row);
  assert.equal(display.pathSuffix, "/file/d/xyz/view");
  assert.equal(display.href, row.normalized_url);
}

function testCandidateRawUrlFallback() {
  const display = parseSourceUrlDisplayFromCandidate({
    ds_id: "",
    ds_number: "",
    project_id: "",
    project_title: "",
    project_status: "",
    project_type: "",
    turnaround_type: "",
    shop_code: "",
    source_column: "",
    raw_url: "https://example.com/path/to/page",
    normalized_url: "",
    domain: "example.com",
    canonical_domain: "example.com",
    first_req_description: "",
    first_req_note: "",
  });
  assert.equal(display.pathSuffix, "/path/to/page");
}

testHostAndPath();
testDomainOnly();
testReviewRow();
testCandidateRawUrlFallback();
console.log("evalSourceUrlDisplay.test.ts: all checks passed");
