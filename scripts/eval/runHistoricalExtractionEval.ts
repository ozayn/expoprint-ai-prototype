#!/usr/bin/env node
/**
 * Historical Metabase CSV → design-intake extract → JSONL run + scored CSV.
 *
 *   npm run eval:historical
 *   npx tsx scripts/eval/runHistoricalExtractionEval.ts --input data/eval/my.csv
 */
import { getArg, hasFlag, printHelp } from "./lib/cliArgs.js";
import { runHistoricalExtractionEval } from "./lib/runHistoricalExtraction.js";
import type { HistoricalEvalMode } from "./lib/types.js";

function parseMode(raw: string | undefined): HistoricalEvalMode {
  if (raw === "website_plus_requirements") return "website_plus_requirements";
  return "website_only";
}

function parseLimit(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function main(): Promise<void> {
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp("Usage: npm run eval:historical -- [options]", [
      "--input <path>     Metabase CSV (default: example CSV)",
      "--mode <mode>      website_only | website_plus_requirements",
      "--dry-run          Normalize + score only; no HTTP extraction",
      "--limit <n>        Process first N rows only",
      "--base-url <url>   Extract API host (default: http://localhost:3000)",
      "",
      "Requires dev server unless --dry-run. Set DESIGN_INTAKE_API_URL to override base URL.",
    ]);
    process.exit(0);
  }

  const dryRun = hasFlag("--dry-run");
  const result = await runHistoricalExtractionEval({
    inputPath: getArg("--input"),
    mode: parseMode(getArg("--mode")),
    dryRun,
    limit: parseLimit(getArg("--limit")),
    baseUrl: getArg("--base-url"),
  });

  console.log("Historical extraction evaluation");
  console.log(`  Run ID:        ${result.runId}`);
  console.log(`  Rows:          ${result.recordCount}`);
  console.log(`  Score lines:   ${result.scoreRowCount}`);
  console.log(`  Run output:    ${result.runPath}`);
  console.log(`  Results CSV:   ${result.resultsPath}`);
  if (dryRun) {
    console.log("  (dry-run — no live extraction; start dev server and re-run without --dry-run)");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
