#!/usr/bin/env node
/**
 * Combine all batch review queues and publish sanitized JSON for /internal/eval.
 *
 *   npm run eval:publish-latest-internal
 */
import { hasFlag, printHelp } from "./lib/cliArgs.js";
import { runPublishLatestInternalEvalCli } from "./lib/publishLatestInternalEval.js";

function main(): void {
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp("Usage: npm run eval:publish-latest-internal", [
      "",
      "1. Combines all data/eval/results/review_queue_<timestamp>.csv batches",
      "2. Publishes the new combined file to:",
      "   data/eval/public/internal-eval-review.json",
      "",
      "Options:",
      "  --include-url-inventory     Also publish sanitized URL inventory JSON",
      "  --include-project-context   Include project titles in inventory (off by default)",
      "  --url-candidates <file>     url_candidates CSV (default: largest real file)",
      "  --no-include-domains        Site N labels instead of domains (default: domains on)",
      "  --no-include-logo-urls      Logo counts only, no logo URLs",
      "",
      "Does not commit or push. Review the JSON, then commit and push manually.",
      "",
      "Example:",
      "  npm run eval:publish-latest-internal",
      "  open data/eval/public/internal-eval-review.json",
      "  git add data/eval/public/internal-eval-review.json",
      '  git commit -m "Update internal eval dataset"',
      "  git push",
    ]);
    process.exit(0);
    return;
  }

  try {
    runPublishLatestInternalEvalCli();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
