import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  DesignIntakeExtractRequest,
  DesignIntakeExtractResponse,
} from "../../../src/lib/designIntakeApiSchema";
import {
  extractionSummaryRowsFromRecords,
  extractionSummaryToCsv,
  runExtractionBatchForInputs,
} from "../../../src/lib/evalLocal/extractionBatch";
import type {
  ExtractionJsonlRecord,
  UrlCandidateExtractionInput,
} from "../../../src/lib/evalLocal/extractionTypes";
import {
  firstPositionalArg,
  getArg,
  getArgNumber,
  hasFlag,
  printHelp,
} from "./cliArgs.js";
import { loadEnvLocal } from "./loadEnvLocal.js";
import type { ProcessedExtractionOutcome } from "./reviewQueueProcessedIndex.js";
import {
  EVAL_RESULTS_DIR,
  EVAL_RUNS_DIR,
  ensureEvalDirs,
  runTimestampId,
} from "./paths.js";
import {
  selectUrlCandidatesWithSummary,
  printUrlCandidateSelectionSummary,
  type UrlCandidateSelectionSummary,
} from "./selectUrlCandidates.js";
import { loadUrlCandidatesFromCsv } from "./urlCandidates.js";
import type { UrlCandidateOutputRow } from "./urlCandidates.js";

export type {
  ExtractionJsonlRecord,
  ExtractionRunStatus,
  ExtractionSummaryRow,
  UrlCandidateExtractionInput,
} from "../../../src/lib/evalLocal/extractionTypes.js";

export type ProcessedUrlSelectionOptions = {
  processedStatusIndex?: Map<string, ProcessedExtractionOutcome>;
  processedReviewIndex?: Map<string, import("./historicalReviewQueue.js").ReviewQueueRow>;
  retryFailed?: boolean;
  reprocess?: boolean;
  reprocessMissingColors?: boolean;
  prioritizeRootUrls?: boolean;
  preserveOrder?: boolean;
  rootOnly?: boolean;
};

export type RunHistoricalWebsiteExtractionOptions = {
  inputPath: string;
  limit?: number;
  offset?: number;
  allowDuplicateDomains?: boolean;
  delayMs?: number;
  apiUrl?: string;
  stylePreference?: string;
  processedSelection?: ProcessedUrlSelectionOptions;
};

function toExtractionInput(row: UrlCandidateOutputRow): UrlCandidateExtractionInput {
  return {
    ds_id: row.ds_id,
    ds_number: row.ds_number,
    project_title: row.project_title,
    project_type: row.project_type,
    shop_code: row.shop_code,
    source_column: row.source_column,
    normalized_url: row.normalized_url,
    domain: row.domain,
    canonical_domain: row.canonical_domain,
    first_req_description: row.first_req_description,
    first_req_note: row.first_req_note,
  };
}

async function callExtractApi(
  baseUrl: string,
  body: DesignIntakeExtractRequest,
): Promise<{ response: DesignIntakeExtractResponse; durationMs: number }> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/design-intake/extract`;
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: DesignIntakeExtractResponse;
  try {
    parsed = JSON.parse(text) as DesignIntakeExtractResponse;
  } catch {
    throw new Error(
      res.ok
        ? "Extract response was not valid JSON"
        : `HTTP ${res.status}: invalid JSON body`,
    );
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(parsed).slice(0, 200)}`);
  }
  return { response: parsed, durationMs: Date.now() - t0 };
}

type ExtractFn = (
  body: DesignIntakeExtractRequest,
) => Promise<{ response: DesignIntakeExtractResponse; durationMs: number }>;

async function createInProcessExtractFn(): Promise<ExtractFn> {
  try {
    const mod = await import("../../../src/lib/runDesignIntakeExtract");
    return async (body) => {
      const { response, durationMs } = await mod.runDesignIntakeExtract(body);
      return { response, durationMs };
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to load in-process extraction (${detail}). ` +
        "Start the dev server and pass --api-url http://localhost:3000, " +
        "or fix the import path / dependencies.",
    );
  }
}

async function resolveExtractFn(apiUrl?: string): Promise<ExtractFn> {
  if (apiUrl) {
    return (body) => callExtractApi(apiUrl, body);
  }
  loadEnvLocal();
  return createInProcessExtractFn();
}

function writeExtractionProgressLine(line: string): void {
  process.stdout.write(`${line}\n`);
}

export async function runHistoricalWebsiteExtraction(
  options: RunHistoricalWebsiteExtractionOptions,
): Promise<{
  runId: string;
  jsonlPath: string;
  summaryPath: string;
  selectedCount: number;
  records: ExtractionJsonlRecord[];
  selectionSummary?: UrlCandidateSelectionSummary;
}> {
  const limit = options.limit ?? 10;
  const offset = options.offset ?? 0;
  const allowDuplicateDomains = options.allowDuplicateDomains ?? false;
  const delayMs = options.delayMs ?? 1000;

  ensureEvalDirs();
  const runId = runTimestampId();
  const jsonlPath = join(EVAL_RUNS_DIR, `extraction_run_${runId}.jsonl`);
  const summaryPath = join(
    EVAL_RESULTS_DIR,
    `extraction_summary_${runId}.csv`,
  );

  const { candidates } = loadUrlCandidatesFromCsv(options.inputPath);
  const selection = selectUrlCandidatesWithSummary(candidates, {
    allowDuplicateDomains,
    offset,
    limit,
    processedStatusIndex: options.processedSelection?.processedStatusIndex,
    processedReviewIndex: options.processedSelection?.processedReviewIndex,
    retryFailed: options.processedSelection?.retryFailed,
    reprocess: options.processedSelection?.reprocess,
    reprocessMissingColors: options.processedSelection?.reprocessMissingColors,
    prioritizeRootUrls: options.processedSelection?.prioritizeRootUrls,
    preserveOrder: options.processedSelection?.preserveOrder,
    rootOnly: options.processedSelection?.rootOnly,
  });

  if (selection.summary) {
    console.log("");
    printUrlCandidateSelectionSummary(selection.summary);
  }

  const selected = selection.selected;

  const extract = await resolveExtractFn(options.apiUrl);
  const inputs = selected.map(toExtractionInput);

  const records = await runExtractionBatchForInputs(inputs, {
    delayMs,
    extractFn: extract,
    onProgress: (event) => {
      if (event.phase === "start") {
        writeExtractionProgressLine(
          `[${event.index}/${event.total}] extracting ${event.url}`,
        );
        return;
      }
      const seconds = Math.max(1, Math.round((event.elapsedMs ?? 0) / 1000));
      writeExtractionProgressLine(
        `[${event.index}/${event.total}] ${event.status ?? "done"} (${seconds}s) ${event.url}`,
      );
    },
  });

  const jsonl = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeFileSync(jsonlPath, jsonl, "utf8");

  const metaPath = join(EVAL_RUNS_DIR, `extraction_run_meta_${runId}.json`);
  writeFileSync(
    metaPath,
    JSON.stringify(
      {
        run_id: runId,
        input_path: options.inputPath,
        limit,
        offset,
        allow_duplicate_domains: allowDuplicateDomains,
        delay_ms: delayMs,
        ...(options.apiUrl ? { api_url: options.apiUrl } : {}),
        created_at: new Date().toISOString(),
        jsonl_path: jsonlPath,
        summary_path: summaryPath,
        row_count: records.length,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  writeFileSync(
    summaryPath,
    extractionSummaryToCsv(extractionSummaryRowsFromRecords(records)),
    "utf8",
  );

  return {
    runId,
    jsonlPath,
    summaryPath,
    selectedCount: selected.length,
    records,
    selectionSummary: selection.summary,
  };
}

export const WEBSITE_EXTRACTION_CLI_HELP_LINES = [
  "",
  "Options:",
  "  --limit N                 Max sites to extract (default: 10)",
  "  --offset N                Skip N rows after domain dedupe (default: 0)",
  "  --allow-duplicate-domains Test multiple rows per domain",
  "  --delay-ms N              Pause between requests (default: 1000)",
  "  --api-url URL             Call POST /api/design-intake/extract instead of in-process",
] as const;

export type ParsedWebsiteExtractionCli = {
  inputPath?: string;
  showHelp: boolean;
  options: Omit<RunHistoricalWebsiteExtractionOptions, "inputPath">;
};

export function parseWebsiteExtractionCli(
  argv: string[] = process.argv,
): ParsedWebsiteExtractionCli {
  const inputPath = firstPositionalArg(argv);
  const showHelp = !inputPath || hasFlag("--help", argv) || hasFlag("-h", argv);

  return {
    inputPath,
    showHelp,
    options: {
      limit: getArgNumber("--limit", 10, argv),
      offset: getArgNumber("--offset", 0, argv),
      delayMs: getArgNumber("--delay-ms", 1000, argv),
      allowDuplicateDomains: hasFlag("--allow-duplicate-domains", argv),
      apiUrl: getArg("--api-url", argv),
    },
  };
}

export function printWebsiteExtractionRunHeader(
  inputPath: string,
  options: Omit<RunHistoricalWebsiteExtractionOptions, "inputPath">,
  extractAndReviewContext?: {
    skipProcessedByDefault: boolean;
    retryFailed: boolean;
    reprocess: boolean;
    reprocessMissingColors?: boolean;
    mergedReviewRows: number;
    prioritizeRootUrls?: boolean;
    rootOnly?: boolean;
  },
): void {
  const limit = options.limit ?? 10;
  const offset = options.offset ?? 0;
  const delayMs = options.delayMs ?? 1000;
  const allowDuplicateDomains = options.allowDuplicateDomains ?? false;

  console.log("Historical website extraction");
  console.log(`  Input:  ${inputPath}`);
  console.log(`  Limit:  ${limit} (offset ${offset})`);
  console.log(
    `  Domains: ${allowDuplicateDomains ? "duplicates allowed" : "one row per canonical_domain (www. stripped)"}`,
  );
  if (extractAndReviewContext?.skipProcessedByDefault) {
    const mode = extractAndReviewContext.reprocessMissingColors
      ? "missing colors (logo, no palette)"
      : extractAndReviewContext.reprocess
        ? "reprocess all (including successful)"
        : extractAndReviewContext.retryFailed
          ? "not run + failed retries"
          : "not run only";
    console.log(
      `  Prior batches: ${extractAndReviewContext.mergedReviewRows.toLocaleString()} merged review rows · pool: ${mode}`,
    );
    if (extractAndReviewContext.rootOnly) {
      console.log("  URL pool:    root/homepage only (--root-only)");
    } else if (extractAndReviewContext.prioritizeRootUrls) {
      console.log("  URL order:   root URLs first (eligible pool)");
    }
  }
  console.log(`  Delay:  ${delayMs}ms between requests`);
  if (options.limit && options.limit > 1) {
    console.log(
      "  Progress: one start + done line per URL (extraction can take 30–90s each)",
    );
  }
  if (options.apiUrl) console.log(`  API:    ${options.apiUrl}`);
}

export function countRecordsByStatus(
  records: ExtractionJsonlRecord[],
): Record<string, number> {
  return records.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
}

export async function runHistoricalWebsiteExtractionCli(): Promise<void> {
  const parsed = parseWebsiteExtractionCli();

  if (parsed.showHelp) {
    printHelp("Usage: npm run eval:extract -- <url_candidates.csv> [options]", [
      ...WEBSITE_EXTRACTION_CLI_HELP_LINES,
      "",
      "Example:",
      "  npm run eval:extract -- data/eval/results/url_candidates_<id>.csv --limit 5",
    ]);
    process.exit(
      parsed.inputPath || hasFlag("--help") || hasFlag("-h") ? 0 : 1,
    );
    return;
  }

  const inputPath = parsed.inputPath!;
  printWebsiteExtractionRunHeader(inputPath, parsed.options);

  const { jsonlPath, summaryPath, selectedCount, records } =
    await runHistoricalWebsiteExtraction({
      inputPath,
      ...parsed.options,
    });

  const byStatus = countRecordsByStatus(records);

  console.log("");
  console.log(`  Selected: ${selectedCount}`);
  console.log(`  JSONL:    ${jsonlPath}`);
  console.log(`  Summary:  ${summaryPath}`);
  console.log("  By status:");
  for (const [status, count] of Object.entries(byStatus).sort()) {
    console.log(`    ${status}: ${count}`);
  }
}
