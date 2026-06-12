import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  combineReviewQueues,
  type CombineReviewQueuesResult,
} from "./combineReviewQueues.js";
import { getArg, hasFlag } from "./cliArgs.js";
import {
  printPublishInternalEvalSummary,
  printPublishUrlInventorySummary,
  publishReviewQueueCsvToInternalEval,
  publishUrlInventoryToInternalEval,
  type PublishInternalEvalResult,
  type PublishUrlInventoryResult,
} from "./publishInternalEvalLib.js";
import { REPO_ROOT } from "./paths.js";

export type PublishLatestInternalEvalResult = {
  combined: CombineReviewQueuesResult;
  publish: PublishInternalEvalResult;
  urlInventory?: PublishUrlInventoryResult;
  partnerDataCheckPassed: boolean;
};

export function runPartnerDataCheck(): boolean {
  const scriptPath = join(REPO_ROOT, "scripts/check-partner-data-git.sh");
  const result = spawnSync("bash", [scriptPath], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });

  if (result.status === 0) {
    return true;
  }

  if (result.stdout) {
    process.stderr.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  return false;
}

export function runPublishLatestInternalEval(options?: {
  includeDomains?: boolean;
  includeLogoUrls?: boolean;
  includeUrlInventory?: boolean;
  includeProjectContext?: boolean;
  urlCandidatesFilename?: string;
}): PublishLatestInternalEvalResult {
  const includeDomains = options?.includeDomains ?? true;
  const includeLogoUrls = options?.includeLogoUrls ?? true;
  const includeUrlInventory = options?.includeUrlInventory ?? false;
  const includeProjectContext = options?.includeProjectContext ?? false;

  const combined = combineReviewQueues();
  const publish = publishReviewQueueCsvToInternalEval(combined.outputPath, {
    includeDomains,
    includeLogoUrls,
  });

  let urlInventory: PublishUrlInventoryResult | undefined;
  if (includeUrlInventory) {
    urlInventory = publishUrlInventoryToInternalEval(
      publish.file.rows,
      publish.file.source_review_queue,
      {
        includeDomains,
        includeProjectContext,
        includeLogoUrls,
      },
      options?.urlCandidatesFilename,
    );
  }

  const partnerDataCheckPassed = runPartnerDataCheck();

  return {
    combined,
    publish,
    urlInventory,
    partnerDataCheckPassed,
  };
}

export function printPublishLatestInternalEvalSummary(
  result: PublishLatestInternalEvalResult,
): void {
  const { combined, publish, partnerDataCheckPassed } = result;

  console.log("Publish latest internal eval");
  console.log(`  Combined review queue: ${combined.outputPath}`);
  console.log(`  Combined rows:         ${combined.rowsWritten}`);
  console.log(`  Source batch files:    ${combined.sourceFiles.length}`);
  console.log("");

  printPublishInternalEvalSummary(publish);

  if (result.urlInventory) {
    console.log("");
    printPublishUrlInventorySummary(result.urlInventory);
  }

  if (partnerDataCheckPassed) {
    console.log("Partner-data check:      passed");
  } else {
    console.log("Partner-data check:      FAILED — run npm run check:partner-data");
  }

  console.log("");
  console.log("Next steps (manual):");
  console.log("  open data/eval/public/internal-eval-review.json");
  if (result.urlInventory) {
    console.log("  open data/eval/public/internal-eval-url-inventory.json");
  }
  console.log("  git add data/eval/public/internal-eval-review.json");
  if (result.urlInventory) {
    console.log("  git add data/eval/public/internal-eval-url-inventory.json");
  }
  console.log('  git commit -m "Update internal eval dataset"');
  console.log("  git push");
}

export function runPublishLatestInternalEvalCli(): void {
  const includeDomains = !hasFlag("--no-include-domains");
  const includeLogoUrls = !hasFlag("--no-include-logo-urls");
  const includeUrlInventory = hasFlag("--include-url-inventory");
  const includeProjectContext = hasFlag("--include-project-context");
  const urlCandidatesFilename = getArg("--url-candidates");

  const result = runPublishLatestInternalEval({
    includeDomains,
    includeLogoUrls,
    includeUrlInventory,
    includeProjectContext,
    urlCandidatesFilename,
  });
  printPublishLatestInternalEvalSummary(result);

  if (!result.partnerDataCheckPassed) {
    process.exit(1);
  }
}
