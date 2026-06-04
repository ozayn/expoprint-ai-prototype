#!/usr/bin/env node
/**
 * Extract http(s) URL candidates from a local Metabase CSV export.
 *
 *   npm run eval:urls -- data/private/eval/basic_design_service_query_2026-06-04.csv
 *   npm run eval:urls -- data/eval/metabase_sample.example.csv
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  loadUrlCandidatesFromCsv,
  printUrlExtractionSummary,
  urlCandidatesToCsv,
} from "./lib/urlCandidates.js";
import { EVAL_RESULTS_DIR, ensureEvalDirs, runTimestampId } from "./lib/paths.js";

function main(): void {
  const inputPath = process.argv[2];

  if (!inputPath || inputPath === "--help" || inputPath === "-h") {
    console.log("Usage: npm run eval:urls -- <path-to-metabase.csv>");
    console.log("");
    console.log("Reads a local Metabase export and writes URL candidates to:");
    console.log("  data/eval/results/url_candidates_<timestamp>.csv");
    console.log("");
    console.log("Example:");
    console.log(
      "  npm run eval:urls -- data/private/eval/basic_design_service_query_2026-06-04.csv",
    );
    process.exit(inputPath ? 0 : 1);
  }

  ensureEvalDirs();
  const { candidates, summary } = loadUrlCandidatesFromCsv(inputPath);
  const runId = runTimestampId();
  const outPath = join(EVAL_RESULTS_DIR, `url_candidates_${runId}.csv`);
  writeFileSync(outPath, urlCandidatesToCsv(candidates), "utf8");

  console.log("Historical URL candidate extraction");
  console.log(`  Input:  ${inputPath}`);
  console.log(`  Output: ${outPath}`);
  printUrlExtractionSummary(summary);
}

main();
