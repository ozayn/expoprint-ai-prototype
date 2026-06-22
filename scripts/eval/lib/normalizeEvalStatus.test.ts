#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  normalizeEvalStatus,
  normalizeStatusValue,
} from "../../../src/lib/evalLocal/normalizeEvalStatus.js";
import {
  statusFilterFromQueryParams,
  parseEvalStatusParam,
} from "../../../src/lib/evalLocal/evalViewerQuery.js";

assert.equal(normalizeStatusValue("success"), "success");
assert.equal(normalizeStatusValue("Success"), "success");
assert.equal(normalizeStatusValue("ok"), "success");
assert.equal(normalizeStatusValue("completed"), "success");

assert.equal(normalizeStatusValue("fetch_error"), "failed");
assert.equal(normalizeStatusValue("extraction_error"), "failed");
assert.equal(normalizeStatusValue("failed"), "failed");
assert.equal(normalizeStatusValue("Failed"), "failed");
assert.equal(normalizeStatusValue("timeout"), "failed");
assert.equal(normalizeStatusValue("error"), "failed");

assert.equal(normalizeStatusValue(""), "not_run");
assert.equal(normalizeStatusValue("not_run"), "not_run");
assert.equal(normalizeStatusValue("Not run"), "not_run");
assert.equal(normalizeStatusValue("pending"), "not_run");
assert.equal(normalizeStatusValue("missing"), "not_run");

assert.equal(
  normalizeEvalStatus({ status: "fetch_error" }),
  "failed",
);
assert.equal(
  normalizeEvalStatus({ status: "success" }),
  "success",
);
assert.equal(
  normalizeEvalStatus({ extractionStatus: "not_run" }),
  "not_run",
);
assert.equal(
  normalizeEvalStatus({ status: "", extractionStatus: "not_run" }),
  "not_run",
);

assert.equal(parseEvalStatusParam("failed"), "failed");
assert.equal(parseEvalStatusParam("success"), "success");
assert.equal(parseEvalStatusParam("not_run"), "not_run");
assert.equal(parseEvalStatusParam("Not run"), "not_run");

assert.equal(
  statusFilterFromQueryParams({ status: "failed" }),
  "failed",
);
assert.equal(
  statusFilterFromQueryParams({ status: "success" }),
  "success",
);
assert.equal(
  statusFilterFromQueryParams({ inventory: "not_run" }),
  "not_run",
);
assert.equal(
  statusFilterFromQueryParams({ inventory: "failed", sort: "recent" }),
  "failed",
);
assert.equal(
  statusFilterFromQueryParams({ inventory: "recent" }),
  "all",
);

console.log("normalizeEvalStatus.test.ts: all checks passed");
