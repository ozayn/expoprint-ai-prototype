import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  extractionSummaryRowsFromRecords,
  extractionSummaryToCsv,
  runExtractionBatchForInputs,
} from "./extractionBatch";
import {
  EVAL_RESULTS_DIR,
  EVAL_RUNS_DIR,
  ensureEvalDirs,
  runTimestampId,
} from "./evalDirs";
import type { UrlCandidateExtractionInput } from "./extractionTypes";
import {
  MANUAL_URL_DELAY_MS,
  parseAndValidateManualUrls,
  type ManualUrlValidationError,
} from "./manualUrlValidation";

export type ManualUrlBatchUrlResult = {
  url: string;
  normalized_url?: string;
  status: "success" | "error" | "skipped" | "validation_error";
  error_message?: string;
};

export type ManualUrlBatchResult = {
  runId: string;
  jsonlFilename: string;
  summaryFilename: string;
  reviewFilename: string;
  jsonlPath: string;
  summaryPath: string;
  reviewPath: string;
  urlResults: ManualUrlBatchUrlResult[];
  validationErrors: ManualUrlValidationError[];
  truncated: boolean;
  duplicatesRemoved: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
};

function buildManualExtractionInput(
  validated: {
    raw: string;
    normalized_url: string;
    domain: string;
    canonical_domain: string;
  },
  index: number,
  sharedProjectTitle?: string,
): UrlCandidateExtractionInput {
  const dsNumber = `MANUAL-${String(index + 1).padStart(3, "0")}`;
  const projectTitle =
    sharedProjectTitle?.trim() ||
    validated.canonical_domain ||
    validated.domain;

  return {
    ds_id: "",
    ds_number: dsNumber,
    project_title: projectTitle,
    project_type: "",
    shop_code: "",
    source_column: "manual_url",
    normalized_url: validated.normalized_url,
    domain: validated.domain,
    canonical_domain: validated.canonical_domain,
    first_req_description: "",
    first_req_note: "",
  };
}

function spawnReviewQueueBuild(jsonlPath: string): void {
  const result = spawnSync(
    "npx",
    ["tsx", "scripts/eval/buildHistoricalReviewQueue.ts", jsonlPath],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      shell: false,
    },
  );

  if (result.status !== 0) {
    const detail =
      result.stderr?.trim() ||
      result.stdout?.trim() ||
      `review queue build exited ${result.status}`;
    throw new Error(detail);
  }
}

export async function runManualUrlBatch(options: {
  urlLines: string[];
  projectTitle?: string;
  delayMs?: number;
}): Promise<ManualUrlBatchResult> {
  const { valid, errors: validationErrors, truncated, duplicatesRemoved } =
    parseAndValidateManualUrls(options.urlLines);

  if (valid.length === 0) {
    return {
      runId: "",
      jsonlFilename: "",
      summaryFilename: "",
      reviewFilename: "",
      jsonlPath: "",
      summaryPath: "",
      reviewPath: "",
      urlResults: validationErrors.map((e) => ({
        url: e.raw,
        status: "validation_error",
        error_message: e.message,
      })),
      validationErrors,
      truncated,
      duplicatesRemoved,
      successCount: 0,
      errorCount: validationErrors.length,
      skippedCount: 0,
    };
  }

  ensureEvalDirs();
  const runId = runTimestampId();
  const jsonlFilename = `manual_extraction_run_${runId}.jsonl`;
  const summaryFilename = `manual_extraction_summary_${runId}.csv`;
  const reviewFilename = `manual_review_queue_${runId}.csv`;
  const jsonlPath = join(EVAL_RUNS_DIR, jsonlFilename);
  const summaryPath = join(EVAL_RESULTS_DIR, summaryFilename);
  const reviewPath = join(EVAL_RESULTS_DIR, reviewFilename);

  const inputs = valid.map((v, i) =>
    buildManualExtractionInput(v, i, options.projectTitle),
  );

  const delayMs = options.delayMs ?? MANUAL_URL_DELAY_MS;
  const records = await runExtractionBatchForInputs(inputs, { delayMs });

  const jsonl = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeFileSync(jsonlPath, jsonl, "utf8");

  const summaryRows = extractionSummaryRowsFromRecords(records);
  writeFileSync(summaryPath, extractionSummaryToCsv(summaryRows), "utf8");

  spawnReviewQueueBuild(jsonlPath);

  const urlResults: ManualUrlBatchUrlResult[] = [];

  for (const err of validationErrors) {
    if (err.line === 0 && !err.raw) continue;
    urlResults.push({
      url: err.raw,
      status: "validation_error",
      error_message: err.message,
    });
  }

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const record of records) {
    const url = record.input.normalized_url || record.input.domain;
    if (record.status === "success") {
      successCount += 1;
      urlResults.push({ url, normalized_url: record.input.normalized_url, status: "success" });
    } else if (record.status === "skipped") {
      skippedCount += 1;
      urlResults.push({
        url,
        normalized_url: record.input.normalized_url,
        status: "skipped",
        error_message: record.error_message,
      });
    } else {
      errorCount += 1;
      urlResults.push({
        url,
        normalized_url: record.input.normalized_url,
        status: "error",
        error_message: record.error_message,
      });
    }
  }

  if (truncated) {
    urlResults.unshift({
      url: "",
      status: "validation_error",
      error_message: `Only the first ${valid.length} valid URLs were processed (submission cap).`,
    });
  }

  return {
    runId,
    jsonlFilename,
    summaryFilename,
    reviewFilename,
    jsonlPath,
    summaryPath,
    reviewPath,
    urlResults,
    validationErrors,
    truncated,
    duplicatesRemoved,
    successCount,
    errorCount,
    skippedCount,
  };
}
