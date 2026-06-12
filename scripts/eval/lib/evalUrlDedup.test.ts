#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  dedupeEvalUrls,
  normalizeEvalUrl,
  uniqueEvalUrls,
} from "../../../src/lib/evalLocal/evalUrlDedup";

function testNormalizeEvalUrl(): void {
  assert.equal(
    normalizeEvalUrl("https://Example.COM/path/"),
    "https://example.com/path",
  );
  assert.equal(normalizeEvalUrl("https://example.com/"), "https://example.com");
  assert.equal(
    normalizeEvalUrl(
      "https://example.com/page?utm_source=newsletter&utm_medium=email&keep=1",
    ),
    "https://example.com/page?keep=1",
  );
  assert.equal(
    normalizeEvalUrl("https://example.com/page#section"),
    "https://example.com/page",
  );
  assert.equal(
    normalizeEvalUrl("https://example.com/page?b=2&a=1"),
    "https://example.com/page?a=1&b=2",
  );
  assert.equal(
    normalizeEvalUrl("https://example.com/page?a=1&b=2"),
    "https://example.com/page?a=1&b=2",
  );
  assert.equal(
    normalizeEvalUrl("https://example.com/page?gclid=abc&a=1"),
    "https://example.com/page?a=1",
  );
  assert.equal(normalizeEvalUrl(""), null);
  assert.equal(normalizeEvalUrl("  "), null);
  assert.equal(normalizeEvalUrl("mailto:test@example.com"), null);
}

function testEquivalentUrlVariantsDedupeToOne(): void {
  const pathOnlyVariants = [
    "https://example.com/page",
    "https://example.com/page/",
    " https://EXAMPLE.com/page?utm_source=x ",
    "https://example.com/page#section",
  ];

  const pathOnly = uniqueEvalUrls(pathOnlyVariants);
  assert.equal(pathOnly.length, 1);
  assert.equal(pathOnly[0], "https://example.com/page");

  const queryOrderVariants = [
    "https://example.com/page?b=2&a=1",
    "https://example.com/page?a=1&b=2",
  ];
  const queryOrder = uniqueEvalUrls(queryOrderVariants);
  assert.equal(queryOrder.length, 1);
  assert.equal(queryOrder[0], "https://example.com/page?b=2&a=1");

  const deduped = dedupeEvalUrls(pathOnlyVariants, (url) => url);
  assert.equal(deduped.beforeCount, 4);
  assert.equal(deduped.afterCount, 1);
  assert.equal(deduped.duplicatesRemoved, 3);
}

function testUniqueEvalUrls(): void {
  const unique = uniqueEvalUrls([
    "https://example.com/",
    "https://example.com?utm_source=x",
    "https://example.com/path/",
    "https://other.com",
  ]);
  assert.deepEqual(unique, [
    "https://example.com/",
    "https://example.com/path/",
    "https://other.com",
  ]);
}

function main(): void {
  testNormalizeEvalUrl();
  testEquivalentUrlVariantsDedupeToOne();
  testUniqueEvalUrls();
  console.log("evalUrlDedup.test.ts: all checks passed");
}

main();
