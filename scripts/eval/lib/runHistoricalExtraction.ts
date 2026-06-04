import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadAndNormalizeMetabaseCsv } from "./normalizeMetabaseRows.js";
import {
  DEFAULT_EXAMPLE_CSV,
  EVAL_RUNS_DIR,
  ensureEvalDirs,
  runTimestampId,
} from "./paths.js";
import { scoreAndWriteResults, scoreRunRecords } from "./scoreHistoricalExtraction.js";
import type {
  HistoricalEvalMode,
  HistoricalRunRecord,
  NormalizedMetabaseRow,
} from "./types.js";

export type RunHistoricalEvalOptions = {
  inputPath?: string;
  mode?: HistoricalEvalMode;
  dryRun?: boolean;
  limit?: number;
  baseUrl?: string;
  productCategory?: string;
  stylePreference?: string;
};

function buildCustomerInstructions(row: NormalizedMetabaseRow): string | undefined {
  const parts = [row.first_req_description, row.first_req_note]
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts.join("\n\n");
}

function defaultProductCategory(projectType: string): string {
  const t = projectType.toLowerCase();
  if (t.includes("outdoor") || t.includes("tent")) return "Outdoor tent";
  return "Trade show booth";
}

async function callExtractApi(
  baseUrl: string,
  body: Record<string, unknown>,
): Promise<{ response: unknown; durationMs: number }> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/design-intake/extract`;
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
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

export async function runHistoricalExtractionEval(
  options: RunHistoricalEvalOptions = {},
): Promise<{
  runId: string;
  runPath: string;
  resultsPath: string;
  recordCount: number;
  scoreRowCount: number;
}> {
  const inputPath = options.inputPath ?? DEFAULT_EXAMPLE_CSV;
  const mode: HistoricalEvalMode = options.mode ?? "website_only";
  const dryRun = options.dryRun ?? false;
  const limit = options.limit;
  const baseUrl =
    options.baseUrl ??
    process.env.DESIGN_INTAKE_API_URL ??
    "http://localhost:3000";
  const stylePreference = options.stylePreference ?? "Modern";

  ensureEvalDirs();
  const runId = runTimestampId();
  const runPath = join(EVAL_RUNS_DIR, `run_${runId}.jsonl`);

  let rows = loadAndNormalizeMetabaseCsv(inputPath);
  if (typeof limit === "number" && limit > 0) {
    rows = rows.slice(0, limit);
  }

  const records: HistoricalRunRecord[] = [];
  const timestamp = new Date().toISOString();

  for (const row of rows) {
    if (row.skip_reason === "missing_url") {
      records.push({
        run_id: runId,
        mode,
        timestamp,
        status: "skipped",
        skip_reason: "missing_url",
        row,
      });
      continue;
    }

    const productCategory =
      options.productCategory ?? defaultProductCategory(row.project_type);

    const extractRequest: HistoricalRunRecord["extract_request"] = {
      websiteUrl: row.website_url,
      productCategory,
      stylePreference,
    };

    if (mode === "website_plus_requirements") {
      const instructions = buildCustomerInstructions(row);
      if (instructions) extractRequest.customerInstructions = instructions;
    }

    if (dryRun) {
      records.push({
        run_id: runId,
        mode,
        timestamp,
        status: "dry_run",
        row,
        extract_request: extractRequest,
      });
      continue;
    }

    try {
      const { response, durationMs } = await callExtractApi(
        baseUrl,
        extractRequest as Record<string, unknown>,
      );
      records.push({
        run_id: runId,
        mode,
        timestamp,
        status: "success",
        duration_ms: durationMs,
        row,
        extract_request: extractRequest,
        extract_response: response,
      });
    } catch (err) {
      records.push({
        run_id: runId,
        mode,
        timestamp,
        status: "error",
        error_message: err instanceof Error ? err.message : String(err),
        row,
        extract_request: extractRequest,
      });
    }
  }

  const jsonl = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
  writeFileSync(runPath, jsonl, "utf8");

  const scores = scoreRunRecords(records);
  const resultsPath = scoreAndWriteResults(records, runId);

  return {
    runId,
    runPath,
    resultsPath,
    recordCount: records.length,
    scoreRowCount: scores.length,
  };
}
