#!/usr/bin/env node
/**
 * Normalize a Metabase CSV export to JSON on stdout.
 *
 *   npx tsx scripts/eval/normalizeMetabaseRows.ts --input data/eval/my_export.csv
 */
import { writeFileSync } from "node:fs";
import { getArg, hasFlag, printHelp } from "./lib/cliArgs.js";
import { loadAndNormalizeMetabaseCsv } from "./lib/normalizeMetabaseRows.js";
import { DEFAULT_EXAMPLE_CSV } from "./lib/paths.js";

function main(): void {
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp("Usage: npx tsx scripts/eval/normalizeMetabaseRows.ts [options]", [
      "--input <path>   CSV file (default: data/eval/metabase_sample.example.csv)",
      "--out <path>     Write JSON array to file instead of stdout",
    ]);
    process.exit(0);
  }

  const input = getArg("--input") ?? DEFAULT_EXAMPLE_CSV;
  const out = getArg("--out");
  const rows = loadAndNormalizeMetabaseCsv(input);
  const json = JSON.stringify(rows, null, 2);

  if (out) {
    writeFileSync(out, json, "utf8");
    console.log(`Wrote ${rows.length} normalized rows to ${out}`);
  } else {
    console.log(json);
  }
}

main();
