import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import {
  colorEntriesForRow,
  logoCandidatesForRow,
} from "../../../src/lib/evalLocal/brandExtractionParse.js";
import type { BrandAuditRow } from "../../../src/lib/evalLocal/brandAuditRow.js";
import { emailsForRow, phonesForRow } from "../../../src/lib/evalLocal/contactExtractionParse.js";
import { offeringsForRow } from "../../../src/lib/evalLocal/offeringsExtractionParse.js";
import { csvRowsToObjects, parseCsv } from "../../../src/lib/evalLocal/parseCsv.js";
import type { PublishedInternalEvalFile } from "../../../src/lib/evalLocal/publishedInternalEvalTypes.js";
import {
  buildPublishedInternalEvalFile,
  type PublishSanitizeOptions,
  type PublishSanitizeStats,
} from "../../../src/lib/evalInternal/sanitizePublishedReview.js";
import {
  INTERNAL_EVAL_PUBLIC_DIR,
  INTERNAL_EVAL_REVIEW_PATH,
  INTERNAL_EVAL_URL_INVENTORY_PATH,
} from "../../../src/lib/evalInternal/constants.js";
import {
  buildPublishedUrlInventoryFile,
  type PublishUrlInventoryOptions,
  type PublishUrlInventoryStats,
} from "../../../src/lib/evalInternal/sanitizePublishedUrlInventory.js";
import type { PublishedInternalEvalUrlInventoryFile } from "../../../src/lib/evalLocal/publishedInternalEvalTypes.js";
import { EVAL_RESULTS_DIR, REPO_ROOT } from "./paths.js";
import {
  pickUrlCandidatesFilePath,
  readUrlCandidatesCsvSync,
} from "./urlCandidatesFile.js";

export type PublishedFieldCounts = {
  logoCandidates: number;
  paletteColors: number;
  emails: number;
  phones: number;
  productsServices: number;
};

export type PublishInternalEvalResult = {
  inputPath: string;
  outputPath: string;
  file: PublishedInternalEvalFile;
  stats: PublishSanitizeStats;
  fieldCounts: PublishedFieldCounts;
  options: PublishSanitizeOptions;
};

export type PublishUrlInventoryResult = {
  inputPath: string;
  outputPath: string;
  sourceUrlCandidates: string;
  file: PublishedInternalEvalUrlInventoryFile;
  stats: PublishUrlInventoryStats;
  options: PublishUrlInventoryOptions;
};

const REVIEW_QUEUE_INPUT_RE =
  /^(?:review_queue_|manual_review_queue_|review_queue_combined_)20\d{12}(?:\d{3})?\.csv$/;

export function isSafeReviewQueueInputPath(inputPath: string): boolean {
  const name = basename(inputPath);
  if (!REVIEW_QUEUE_INPUT_RE.test(name)) {
    return false;
  }
  const resolved = resolve(inputPath);
  const resultsDir = resolve(REPO_ROOT, "data", "eval", "results");
  return resolved.startsWith(resultsDir + "/") || resolved === resolve(resultsDir, name);
}

export function countPublishedFieldTotals(rows: BrandAuditRow[]): PublishedFieldCounts {
  let logoCandidates = 0;
  let paletteColors = 0;
  let emails = 0;
  let phones = 0;
  let productsServices = 0;

  for (const row of rows) {
    logoCandidates += logoCandidatesForRow(row).length;
    paletteColors += colorEntriesForRow(row).length;
    emails += emailsForRow(row).length;
    phones += phonesForRow(row).length;
    productsServices += offeringsForRow(row).length;
  }

  return {
    logoCandidates,
    paletteColors,
    emails,
    phones,
    productsServices,
  };
}

export function publishReviewQueueCsvToInternalEval(
  inputPath: string,
  options: PublishSanitizeOptions,
): PublishInternalEvalResult {
  const resolvedInput = resolve(inputPath);

  if (!resolvedInput.startsWith(resolve(EVAL_RESULTS_DIR))) {
    throw new Error(`Input must live under ${EVAL_RESULTS_DIR}`);
  }

  if (!isSafeReviewQueueInputPath(resolvedInput)) {
    throw new Error(
      "Input must be data/eval/results/review_queue_<timestamp>.csv, review_queue_combined_<timestamp>.csv, or manual_review_queue_<timestamp>.csv (gitignored raw file).",
    );
  }

  const text = readFileSync(resolvedInput, "utf8");
  const { records } = csvRowsToObjects(parseCsv(text));
  const { file, stats } = buildPublishedInternalEvalFile(
    basename(resolvedInput),
    records,
    options,
  );
  const fieldCounts = countPublishedFieldTotals(file.rows);

  mkdirSync(INTERNAL_EVAL_PUBLIC_DIR, { recursive: true });
  writeFileSync(
    INTERNAL_EVAL_REVIEW_PATH,
    JSON.stringify(file, null, 2) + "\n",
    "utf8",
  );

  return {
    inputPath: resolvedInput,
    outputPath: INTERNAL_EVAL_REVIEW_PATH,
    file,
    stats,
    fieldCounts,
    options,
  };
}

export function printPublishInternalEvalSummary(result: PublishInternalEvalResult): void {
  const { stats, fieldCounts, options } = result;

  console.log("Publish internal eval");
  console.log(`  Input:                ${result.inputPath}`);
  console.log(`  Rows read:            ${stats.rowsRead}`);
  console.log(`  Rows published:       ${stats.rowsPublished}`);
  console.log(`  Rows with logos:      ${stats.rowsWithLogos}`);
  console.log(`  Rows with palettes:   ${stats.rowsWithPalettes}`);
  console.log(`  Logos (items):        ${fieldCounts.logoCandidates}`);
  console.log(`  Palettes (colors):    ${fieldCounts.paletteColors}`);
  console.log(`  Emails (items):       ${fieldCounts.emails}`);
  console.log(`  Phones (items):       ${fieldCounts.phones}`);
  console.log(`  Products/services:    ${fieldCounts.productsServices}`);
  console.log(
    `  Domains included:     ${options.includeDomains ? "yes" : "no (Site N labels)"}`,
  );
  console.log(
    `  Logo URLs included:   ${options.includeLogoUrls ? "yes" : "no"}`,
  );
  console.log(`  Output:               ${result.outputPath}`);
  console.log("");
  console.log("Review data/eval/public/internal-eval-review.json before committing.");
}

export function publishUrlInventoryToInternalEval(
  publishedReviewRows: BrandAuditRow[],
  sourceReviewQueueBasename: string,
  options: PublishUrlInventoryOptions,
  urlCandidatesFilename?: string,
): PublishUrlInventoryResult {
  const picked = pickUrlCandidatesFilePath(EVAL_RESULTS_DIR, urlCandidatesFilename);
  const candidates = readUrlCandidatesCsvSync(EVAL_RESULTS_DIR, picked.filename);
  const { file, stats } = buildPublishedUrlInventoryFile(
    picked.filename,
    sourceReviewQueueBasename,
    candidates,
    publishedReviewRows,
    options,
  );

  mkdirSync(INTERNAL_EVAL_PUBLIC_DIR, { recursive: true });
  writeFileSync(
    INTERNAL_EVAL_URL_INVENTORY_PATH,
    JSON.stringify(file, null, 2) + "\n",
    "utf8",
  );

  return {
    inputPath: picked.path,
    outputPath: INTERNAL_EVAL_URL_INVENTORY_PATH,
    sourceUrlCandidates: picked.filename,
    file,
    stats,
    options,
  };
}

export function printPublishUrlInventorySummary(result: PublishUrlInventoryResult): void {
  const { stats, options } = result;

  console.log("Publish URL inventory");
  console.log(`  Input:                ${result.inputPath}`);
  console.log(`  Candidates read:    ${stats.candidatesRead}`);
  console.log(`  Rows published:     ${stats.rowsPublished}`);
  console.log(`  Matched (processed): ${stats.matchedCount}`);
  console.log(`  Not run:            ${stats.notRunCount}`);
  console.log(`  Success:            ${stats.successCount}`);
  console.log(`  Failed:             ${stats.failedCount}`);
  if (stats.urlDuplicatesRemoved > 0) {
    console.log(`  URL duplicates removed: ${stats.urlDuplicatesRemoved}`);
  }
  console.log(
    `  Domains included:     ${options.includeDomains ? "yes" : "no (URL N labels)"}`,
  );
  console.log(
    `  Project context:      ${options.includeProjectContext ? "yes" : "no"}`,
  );
  console.log(`  Output:               ${result.outputPath}`);
  console.log("");
  console.log(
    "Review data/eval/public/internal-eval-url-inventory.json before committing.",
  );
}
