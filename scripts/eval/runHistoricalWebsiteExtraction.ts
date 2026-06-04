#!/usr/bin/env node
/**
 * Run design-intake website extraction on a limited sample from url_candidates CSV.
 *
 *   npm run eval:extract -- data/eval/results/url_candidates_<timestamp>.csv --limit 5
 */
import { runHistoricalWebsiteExtractionCli } from "./lib/historicalWebsiteExtraction.js";

runHistoricalWebsiteExtractionCli().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
