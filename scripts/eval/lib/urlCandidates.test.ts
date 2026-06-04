#!/usr/bin/env node
/**
 * Smoke tests for URL candidate extraction (no test framework required).
 *
 *   npx tsx scripts/eval/lib/urlCandidates.test.ts
 */
import assert from "node:assert/strict";
import {
  extractUrlsFromText,
  isValidBareDomainHost,
  maskUrlAndEmailSpans,
  normalizeUrl,
} from "./urlCandidates.js";

function testNormalizeUrl(): void {
  assert.equal(normalizeUrl("https://Example.COM/path"), "https://example.com/path");
  assert.equal(normalizeUrl("www.example.org"), "https://www.example.org/");
  assert.equal(normalizeUrl("example.net"), "https://example.net/");
  assert.equal(normalizeUrl("  example.co.  "), "https://example.co/");
  assert.equal(normalizeUrl("user@example.com"), null);
}

function testBareDomainExtraction(): void {
  const mixed = extractUrlsFromText(
    "Visit https://example.com and www.example.org or contact user@example.com for example.net info.",
  );
  const normalized = mixed.map((u) => normalizeUrl(u)).filter(Boolean);
  assert.ok(normalized.includes("https://example.com/"));
  assert.ok(normalized.includes("https://www.example.org/"));
  assert.ok(normalized.includes("https://example.net/"));
  assert.equal(
    normalized.filter((u) => u.includes("example.com")).length,
    1,
    "email host must not produce example.com bare domain",
  );
}

function testEmailMasking(): void {
  const text = "Reach user@example.com or admin@shop.io today.";
  const masked = maskUrlAndEmailSpans(text);
  assert.ok(!/user@example\.com/.test(masked));
  const found = extractUrlsFromText(text);
  const hosts = found.map((r) => normalizeUrl(r)).filter(Boolean);
  assert.equal(hosts.length, 0, "masked emails should not yield bare domains");
}

function testInvalidBareHosts(): void {
  assert.equal(isValidBareDomainHost("logo.png"), false);
  assert.equal(isValidBareDomainHost("3.14.159"), false);
  assert.equal(isValidBareDomainHost("v2.0"), false);
  assert.equal(isValidBareDomainHost("example.com"), true);
}

function testDecimalNotDomain(): void {
  const found = extractUrlsFromText("Version 2.0.1 shipped; budget was 3.5 million.");
  assert.equal(found.length, 0);
}

function main(): void {
  testNormalizeUrl();
  testBareDomainExtraction();
  testEmailMasking();
  testInvalidBareHosts();
  testDecimalNotDomain();
  console.log("urlCandidates.test.ts: all checks passed");
}

main();
