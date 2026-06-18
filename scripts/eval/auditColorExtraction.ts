#!/usr/bin/env node
/**
 * Audit color/palette extraction from a historical extraction JSONL run.
 *
 *   npm run eval:audit-colors -- data/eval/runs/extraction_run_<timestamp>.jsonl
 */
import { runColorExtractionAuditCli } from "./lib/auditColorExtraction.js";

try {
  runColorExtractionAuditCli();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
