#!/usr/bin/env node
/**
 * Run website extraction on URL candidates, then build the review queue from that run.
 *
 *   npm run eval:extract-and-review -- data/eval/results/url_candidates_<id>.csv --limit 10
 */
import { runExtractAndReviewCli } from "./lib/extractAndReview.js";

runExtractAndReviewCli().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
