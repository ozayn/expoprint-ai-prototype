#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  normalizeEmail,
  normalizePhoneDisplay,
  dedupeEmails,
  dedupePhones,
} from "../../../src/lib/contactFieldNormalize.js";

assert.equal(normalizeEmail("mailto:Hello@Example.com"), "hello@example.com");
assert.equal(normalizeEmail("  BAD "), "");

assert.equal(normalizePhoneDisplay("tel:+1-555-123-4567"), "+1 (555) 123-4567");
assert.equal(dedupePhones(["555-123-4567", "tel:5551234567"]).length, 1);
assert.equal(dedupeEmails(["a@b.com", "mailto:A@b.com"]).length, 1);

console.log("contactFieldNormalize.test.ts: all checks passed");
