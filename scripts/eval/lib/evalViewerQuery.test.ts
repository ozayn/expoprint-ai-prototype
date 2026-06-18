#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  buildEvalViewerHref,
  defaultInventoryViewerQuery,
  resolveEvalViewMode,
} from "../../../src/lib/evalLocal/evalViewerQuery.js";

assert.equal(resolveEvalViewMode(undefined, true), "inventory");
assert.equal(resolveEvalViewMode(undefined, false), "gallery");
assert.equal(resolveEvalViewMode("gallery", true), "gallery");
assert.equal(resolveEvalViewMode("table", true), "table");
assert.equal(resolveEvalViewMode("inventory", true), "inventory");
assert.equal(resolveEvalViewMode("inventory", false), "gallery");

const combinedHref = buildEvalViewerHref(
  "/internal/eval",
  defaultInventoryViewerQuery({ review: "combined" }),
);
assert.equal(
  combinedHref,
  "/internal/eval?review=combined&view=inventory&sort=recent",
);

console.log("evalViewerQuery.test.ts: all checks passed");
