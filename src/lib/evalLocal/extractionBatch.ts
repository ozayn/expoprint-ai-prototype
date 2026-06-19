import type {
  DesignIntakeExtractRequest,
  DesignIntakeExtractResponse,
} from "@/lib/designIntakeApiSchema";
import { isStaticFetchBlocked } from "@/lib/websiteFetchBlocked";
import { runDesignIntakeExtract } from "@/lib/runDesignIntakeExtract";
import type {
  ExtractionJsonlRecord,
  ExtractionRunStatus,
  ExtractionSummaryRow,
  UrlCandidateExtractionInput,
} from "./extractionTypes";

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
  if (fetch?.status === "failed" || (fetch && isStaticFetchBlocked(fetch))) {
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

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function extractionSummaryToCsv(rows: ExtractionSummaryRow[]): string {
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

export function extractionSummaryRowsFromRecords(
  records: ExtractionJsonlRecord[],
): ExtractionSummaryRow[] {
  return records.map((r) => {
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
}

export type ExtractionBatchExtractFn = (
  body: DesignIntakeExtractRequest,
) => Promise<{ response: DesignIntakeExtractResponse; durationMs: number }>;

export type ExtractionProgressEvent = {
  index: number;
  total: number;
  url: string;
  phase: "start" | "done";
  status?: ExtractionRunStatus;
  elapsedMs?: number;
};

export type RunExtractionBatchOptions = {
  delayMs?: number;
  onProgress?: (event: ExtractionProgressEvent) => void;
  extractFn?: ExtractionBatchExtractFn;
};

async function defaultExtractFn(
  body: DesignIntakeExtractRequest,
): Promise<{ response: DesignIntakeExtractResponse; durationMs: number }> {
  const { response, durationMs } = await runDesignIntakeExtract(body);
  return { response, durationMs };
}

/**
 * Run design-intake extraction for a list of URL candidate inputs.
 * Shared by eval:extract CLI and local manual URL batch processing.
 */
export async function runExtractionBatchForInputs(
  inputs: UrlCandidateExtractionInput[],
  options: RunExtractionBatchOptions = {},
): Promise<ExtractionJsonlRecord[]> {
  const delayMs = options.delayMs ?? 1000;
  const extract = options.extractFn ?? defaultExtractFn;
  const records: ExtractionJsonlRecord[] = [];
  const total = inputs.length;

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]!;
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

    options.onProgress?.({
      index: i + 1,
      total,
      url,
      phase: "start",
    });

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

    records.push({
      input,
      status,
      elapsed_ms,
      ...(error_message ? { error_message } : {}),
      ...(status === "success" && response ? { expo_output: response } : {}),
    });

    options.onProgress?.({
      index: i + 1,
      total,
      url,
      phase: "done",
      status,
      elapsedMs: elapsed_ms,
    });

    if (i < inputs.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return records;
}
