#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  normalizeEvalUrl,
  uniqueEvalUrls,
} from "../../../src/lib/evalLocal/evalUrlDedup";

function testNormalizeEvalUrl(): void {
  assert.equal(
    normalizeEvalUrl("https://Example.COM/path/"),
    "https://example.com/path",
  );
  assert.equal(
    normalizeEvalUrl("https://example.com/"),
    "https://example.com",
  );
  assert.equal(
    normalizeEvalUrl(
      "https://example.com/page?utm_source=newsletter&utm_medium=email&keep=1",
    ),
    "https://example.com/page?keep=1",
  );
  assert.equal(normalizeEvalUrl(""), null);
  assert.equal(normalizeEvalUrl("  "), null);
  assert.equal(normalizeEvalUrl("mailto:test@example.com"), null);
}

function testUniqueEvalUrls(): void {
  const unique = uniqueEvalUrls([
    "https://example.com/",
    "https://example.com?utm_source=x",
    "https://example.com/path/",
    "https://other.com",
  ]);
  assert.deepEqual(unique, [
    "https://example.com",
    "https://example.com/path",
    "https://other.com",
  ]);
}

function main(): void {
  testNormalizeEvalUrl();
  testUniqueEvalUrls();
  console.log("evalUrlDedup.test.ts: all checks passed");
}

main();
