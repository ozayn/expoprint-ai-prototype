import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  DesignIntakeExtractRequest,
  DesignIntakeExtractResponse,
} from "../../../src/lib/designIntakeApiSchema";
import { isStaticFetchBlocked } from "../../../src/lib/websiteFetchBlocked";
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
import { escapeCsvCell, loadUrlCandidatesFromCsv } from "./urlCandidates.js";
import type { UrlCandidateOutputRow } from "./urlCandidates.js";

export type ExtractionRunStatus =
  | "success"
  | "fetch_error"
  | "extraction_error"
  | "skipped";

export type UrlCandidateExtractionInput = Pick<
  UrlCandidateOutputRow,
  | "ds_id"
  | "ds_number"
  | "project_title"
  | "project_type"
  | "shop_code"
  | "source_column"
  | "normalized_url"
  | "domain"
  | "canonical_domain"
  | "first_req_description"
  | "first_req_note"
>;

export type ExtractionJsonlRecord = {
  input: UrlCandidateExtractionInput;
  status: ExtractionRunStatus;
  elapsed_ms: number;
  error_message?: string;
  expo_output?: DesignIntakeExtractResponse;
};

export type ExtractionSummaryRow = {
  ds_number: string;
  project_title: string;
  project_type: string;
  shop_code: string;
  normalized_url: string;
  domain: string;
  canonical_domain: string;
  status: ExtractionRunStatus;
  elapsed_ms: number;
  error_message: string;
  extracted_business_name: string;
  logo_candidate_count: string;
  pages_inspected: string;
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

function defaultProductCategory(projectType: string): string {
  const t = projectType.toLowerCase();
  if (t.includes("outdoor") || t.includes("tent")) return "Outdoor tent";
  return "Trade show booth";
}

function buildCustomerInstructions(row: UrlCandidateExtractionInput): string | undefined {
  const parts = [row.first_req_description, row.first_req_note]
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts.join("\n\n");
}

function classifyExtractionResult(
  response: DesignIntakeExtractResponse | undefined,
  error: unknown,
): { status: ExtractionRunStatus; error_message?: string } {
  if (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "extraction_error", error_message: message };
  }
  if (!response) {
    return { status: "extraction_error", error_message: "No extract response" };
  }

  const fetch = response.metadata.websiteFetch;
  if (
    fetch?.status === "failed" ||
    (fetch && isStaticFetchBlocked(fetch))
  ) {
    const reason =
      fetch.reason ??
      (response.ok === false ? response.reason : undefined) ??
      "website fetch failed";
    return { status: "fetch_error", error_message: reason };
  }

  if (response.ok) {
    return { status: "success" };
  }

  return {
    status: "extraction_error",
    error_message: response.reason || "extract failed",
  };
}

function metricsFromResponse(
  response: DesignIntakeExtractResponse | undefined,
): Pick<
  ExtractionSummaryRow,
  "extracted_business_name" | "logo_candidate_count" | "pages_inspected"
> {
  if (!response) {
    return {
      extracted_business_name: "",
      logo_candidate_count: "",
      pages_inspected: "",
    };
  }

  const businessName =
    (response.ok ? response.business.name : response.business?.name) ?? "";

  const logoCount = response.brand?.logoCandidates?.length;
  const pages = response.metadata?.pagesInspected;

  return {
    extracted_business_name: businessName,
    logo_candidate_count:
      typeof logoCount === "number" ? String(logoCount) : "",
    pages_inspected: typeof pages === "number" ? String(pages) : "",
  };
}

function buildExtractRequest(row: UrlCandidateExtractionInput): DesignIntakeExtractRequest {
  const request: DesignIntakeExtractRequest = {
    websiteUrl: row.normalized_url,
    productCategory: defaultProductCategory(row.project_type),
    stylePreference: "Modern",
  };
  const instructions = buildCustomerInstructions(row);
  if (instructions) request.customerInstructions = instructions;
  return request;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function extractionSummaryToCsv(rows: ExtractionSummaryRow[]): string {
  const headers: (keyof ExtractionSummaryRow)[] = [
    "ds_number",
    "project_title",
    "project_type",
    "shop_code",
    "normalized_url",
    "domain",
    "canonical_domain",
    "status",
    "elapsed_ms",
    "error_message",
    "extracted_business_name",
    "logo_candidate_count",
    "pages_inspected",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      headers
        .map((h) => {
          const v = row[h];
          return escapeCsvCell(
            typeof v === "number" ? String(v) : (v ?? ""),
          );
        })
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
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
  const records: ExtractionJsonlRecord[] = [];
  const total = selected.length;

  for (let i = 0; i < selected.length; i++) {
    const row = selected[i];
    const input = toExtractionInput(row);
    const url = input.normalized_url.trim();

    if (!url) {
      records.push({
        input,
        status: "skipped",
        elapsed_ms: 0,
        error_message: "missing normalized_url",
      });
      continue;
    }

    console.log(`[${i + 1}/${total}] extracting ${url}`);

    const t0 = Date.now();
    let response: DesignIntakeExtractResponse | undefined;
    let error: unknown;

    try {
      const result = await extract(buildExtractRequest(input));
      response = result.response;
    } catch (err) {
      error = err;
    }

    const elapsed_ms = Date.now() - t0;
    const { status, error_message } = classifyExtractionResult(response, error);

    const record: ExtractionJsonlRecord = {
      input,
      status,
      elapsed_ms,
      ...(error_message ? { error_message } : {}),
      ...(status === "success" && response ? { expo_output: response } : {}),
    };
    records.push(record);

    if (i < selected.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  const jsonl = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeFileSync(jsonlPath, jsonl, "utf8");

  const summaryRows: ExtractionSummaryRow[] = records.map((r) => {
    const metrics = metricsFromResponse(r.expo_output);
    return {
      ds_number: r.input.ds_number,
      project_title: r.input.project_title,
      project_type: r.input.project_type,
      shop_code: r.input.shop_code,
      normalized_url: r.input.normalized_url,
      domain: r.input.domain,
      canonical_domain: r.input.canonical_domain,
      status: r.status,
      elapsed_ms: r.elapsed_ms,
      error_message: r.error_message ?? "",
      ...metrics,
    };
  });
  writeFileSync(summaryPath, extractionSummaryToCsv(summaryRows), "utf8");

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
