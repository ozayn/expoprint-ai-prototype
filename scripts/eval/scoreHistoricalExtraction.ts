#!/usr/bin/env node
/**
 * Score an existing run JSONL file.
 *
 *   npx tsx scripts/eval/scoreHistoricalExtraction.ts --run data/eval/runs/run_<id>.jsonl
 */
import { getArg, hasFlag, printHelp } from "./lib/cliArgs.js";
import { scoreHistoricalRunFile } from "./lib/scoreHistoricalExtraction.js";

async function main(): Promise<void> {
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp("Usage: npx tsx scripts/eval/scoreHistoricalExtraction.ts --run <jsonl>", [
      "--run <path>   Required — run_*.jsonl from data/eval/runs/",
    ]);
    process.exit(0);
  }

  const runPath = getArg("--run");
  if (!runPath) {
    console.error("Missing --run <path>");
    process.exit(1);
  }

  const { outPath, rowCount } = await scoreHistoricalRunFile(runPath);
  console.log(`Scored ${rowCount} field rows → ${outPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
