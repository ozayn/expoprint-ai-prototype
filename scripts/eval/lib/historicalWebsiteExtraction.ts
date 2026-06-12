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
  ExtractionRunStatus,
  ExtractionSummaryRow,
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
import {
  EVAL_RESULTS_DIR,
  EVAL_RUNS_DIR,
  ensureEvalDirs,
  runTimestampId,
} from "./paths.js";
import { selectUrlCandidatesForExtraction } from "./selectUrlCandidates.js";
import { loadUrlCandidatesFromCsv } from "./urlCandidates.js";
import type { UrlCandidateOutputRow } from "./urlCandidates.js";

export type {
  ExtractionJsonlRecord,
  ExtractionRunStatus,
  ExtractionSummaryRow,
  UrlCandidateExtractionInput,
};

export type RunHistoricalWebsiteExtractionOptions = {
  inputPath: string;
  limit?: number;
  offset?: number;
  allowDuplicateDomains?: boolean;
  delayMs?: number;
  apiUrl?: string;
  stylePreference?: string;
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

export async function runHistoricalWebsiteExtraction(
  options: RunHistoricalWebsiteExtractionOptions,
): Promise<{
  runId: string;
  jsonlPath: string;
  summaryPath: string;
  selectedCount: number;
  records: ExtractionJsonlRecord[];
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
  const selected = selectUrlCandidatesForExtraction(candidates, {
    allowDuplicateDomains,
    offset,
    limit,
  });

  const extract = await resolveExtractFn(options.apiUrl);
  const inputs = selected.map(toExtractionInput);
  const total = inputs.length;

  const records = await runExtractionBatchForInputs(inputs, {
    delayMs,
    extractFn: extract,
    onProgress: (index, _total, url) => {
      console.log(`[${index}/${total}] extracting ${url}`);
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
  };
}

export async function runHistoricalWebsiteExtractionCli(): Promise<void> {
  const inputPath = firstPositionalArg();

  if (!inputPath || hasFlag("--help") || hasFlag("-h")) {
    printHelp("Usage: npm run eval:extract -- <url_candidates.csv> [options]", [
      "",
      "Options:",
      "  --limit N                 Max sites to extract (default: 10)",
      "  --offset N                Skip N rows after domain dedupe (default: 0)",
      "  --allow-duplicate-domains Test multiple rows per domain",
      "  --delay-ms N              Pause between requests (default: 1000)",
      "  --api-url URL             Call POST /api/design-intake/extract instead of in-process",
      "",
      "Example:",
      "  npm run eval:extract -- data/eval/results/url_candidates_<id>.csv --limit 5",
    ]);
    process.exit(inputPath || hasFlag("--help") || hasFlag("-h") ? 0 : 1);
    return;
  }

  const limit = getArgNumber("--limit", 10);
  const offset = getArgNumber("--offset", 0);
  const delayMs = getArgNumber("--delay-ms", 1000);
  const allowDuplicateDomains = hasFlag("--allow-duplicate-domains");
  const apiUrl = getArg("--api-url");

  console.log("Historical website extraction");
  console.log(`  Input:  ${inputPath}`);
  console.log(`  Limit:  ${limit} (offset ${offset})`);
  console.log(
    `  Domains: ${allowDuplicateDomains ? "duplicates allowed" : "one row per canonical_domain (www. stripped)"}`,
  );
  console.log(`  Delay:  ${delayMs}ms between requests`);
  if (apiUrl) console.log(`  API:    ${apiUrl}`);

  const { jsonlPath, summaryPath, selectedCount, records } =
    await runHistoricalWebsiteExtraction({
      inputPath,
      limit,
      offset,
      allowDuplicateDomains,
      delayMs,
      apiUrl,
    });

  const byStatus = records.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  console.log("");
  console.log(`  Selected: ${selectedCount}`);
  console.log(`  JSONL:    ${jsonlPath}`);
  console.log(`  Summary:  ${summaryPath}`);
  console.log("  By status:");
  for (const [status, count] of Object.entries(byStatus).sort()) {
    console.log(`    ${status}: ${count}`);
  }
}
