#!/usr/bin/env node
import assert from "node:assert/strict";
import { emptyBrandAuditRow } from "./brandAuditRow.js";
import { pickBetterReviewRow } from "./evalCanonicalDedup.js";
import {
  contactCompletenessForMerge,
  hasMeaningfulExtractionGain,
  isPlausiblePhysicalAddress,
  shouldPreserveRicherContact,
} from "./reviewRowMergeQuality.js";

function reviewRow(
  overrides: Partial<ReturnType<typeof emptyBrandAuditRow>>,
): ReturnType<typeof emptyBrandAuditRow> {
  return { ...emptyBrandAuditRow(), ...overrides };
}

function testOldSuccessWithContactBeatsNewSuccessMissingContact(): void {
  const older = reviewRow({
    normalized_url: "https://example.com/",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    extracted_emails: "hello@example.com",
    extracted_color_hexes: '["#f4ece2"]',
    extracted_social_links:
      '[{"label":"Instagram","url":"https://www.instagram.com/example"}]',
    processed_at: "2026-06-01T00:00:00.000Z",
    extraction_run_id: "20260601000000000",
  });
  const newer = reviewRow({
    normalized_url: "https://example.com/",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    extracted_emails: "hello@example.com",
    extracted_color_hexes: '["#f4ece2","#1d1a13"]',
    processed_at: "2026-06-22T00:00:00.000Z",
    extraction_run_id: "20260622000000000",
  });

  assert.equal(shouldPreserveRicherContact(older, newer), true);
  const kept = pickBetterReviewRow(older, newer);
  assert.equal(kept.extracted_social_links, older.extracted_social_links);
}

function testOldMissingContactNewWithContactWins(): void {
  const older = reviewRow({
    normalized_url: "https://example.com/",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    processed_at: "2026-06-01T00:00:00.000Z",
    extraction_run_id: "20260601000000000",
  });
  const newer = reviewRow({
    normalized_url: "https://example.com/",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    extracted_phone_numbers: "555-0100",
    processed_at: "2026-06-22T00:00:00.000Z",
    extraction_run_id: "20260622000000000",
  });

  const kept = pickBetterReviewRow(older, newer);
  assert.equal(kept.extracted_phone_numbers, "555-0100");
}

function testNewSuccessWithContactGainsAndMinorLossWins(): void {
  const older = reviewRow({
    normalized_url: "https://example.com/",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    extracted_emails: "hello@example.com",
    extracted_phone_numbers: "555-0100",
    extracted_addresses: '["Facebook: https://www.facebook.com/example"]',
    processed_at: "2026-06-01T00:00:00.000Z",
    extraction_run_id: "20260601000000000",
  });
  const newer = reviewRow({
    normalized_url: "https://example.com/",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    extracted_emails: "hello@example.com",
    extracted_phone_numbers: "(555) 0100",
    extracted_social_links:
      '[{"label":"Instagram","url":"https://www.instagram.com/example"}]',
    processed_at: "2026-06-22T00:00:00.000Z",
    extraction_run_id: "20260622000000000",
  });

  assert.equal(contactCompletenessForMerge(older), 2);
  assert.equal(contactCompletenessForMerge(newer), 3);
  const kept = pickBetterReviewRow(older, newer);
  assert.equal(kept.extracted_social_links, newer.extracted_social_links);
}

function testMeaningfulColorGainAllowsNewerDespiteContactLoss(): void {
  const older = reviewRow({
    normalized_url: "https://example.com/",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    extracted_emails: "hello@example.com",
    extracted_social_links:
      '[{"label":"Instagram","url":"https://www.instagram.com/example"}]',
    processed_at: "2026-06-01T00:00:00.000Z",
    extraction_run_id: "20260601000000000",
  });
  const newer = reviewRow({
    normalized_url: "https://example.com/",
    domain: "example.com",
    canonical_domain: "example.com",
    status: "success",
    extracted_emails: "hello@example.com",
    extracted_color_hexes: '["#111111","#222222","#333333","#444444"]',
    palette_source: "logo",
    processed_at: "2026-06-22T00:00:00.000Z",
    extraction_run_id: "20260622000000000",
  });

  assert.equal(hasMeaningfulExtractionGain(older, newer), true);
  const kept = pickBetterReviewRow(older, newer);
  assert.equal(kept.palette_source, "logo");
}

function testNoiseAddressDoesNotCountAsContact(): void {
  assert.equal(
    isPlausiblePhysicalAddress("Social handle graphic provided in uploaded assets"),
    false,
  );
  assert.equal(
    isPlausiblePhysicalAddress("Facebook: https://www.facebook.com/example"),
    false,
  );
  assert.equal(isPlausiblePhysicalAddress("2605 4th Ave N, Seattle, WA"), true);
}

function main(): void {
  testOldSuccessWithContactBeatsNewSuccessMissingContact();
  testOldMissingContactNewWithContactWins();
  testNewSuccessWithContactGainsAndMinorLossWins();
  testMeaningfulColorGainAllowsNewerDespiteContactLoss();
  testNoiseAddressDoesNotCountAsContact();
  console.log("reviewRowMergeQuality.test.ts: all checks passed");
}

main();
