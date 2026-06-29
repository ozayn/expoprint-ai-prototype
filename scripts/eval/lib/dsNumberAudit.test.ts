#!/usr/bin/env node
import assert from "node:assert/strict";
import { auditDsNumberCoverage } from "./dsNumberAudit.js";

function testAuditDsNumberCoverage(): void {
  const stats = auditDsNumberCoverage([
    { ds_number: "15607" },
    { ds_number: "" },
    { ds_number: "  " },
    { ds_number: "999" },
  ]);
  assert.equal(stats.total, 4);
  assert.equal(stats.withDsNumber, 2);
  assert.equal(stats.missingDsNumber, 2);
}

function main(): void {
  testAuditDsNumberCoverage();
  console.log("dsNumberAudit.test.ts: all checks passed");
}

main();
