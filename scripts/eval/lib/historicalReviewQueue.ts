import { readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { DesignIntakeExtractResponse } from "../../../src/lib/designIntakeApiSchema";
import { canonicalDomainFromHost } from "../../../src/lib/evalLocal/canonicalDomain";
import type { ExtractionJsonlRecord } from "./historicalWebsiteExtraction.js";
import { EVAL_RESULTS_DIR, ensureEvalDirs, runTimestampId } from "./paths.js";
import { escapeCsvCell } from "./urlCandidates.js";

export const REVIEW_QUEUE_COLUMNS = [
  "ds_number",
  "ds_id",
  "project_title",
  "project_type",
  "shop_code",
  "normalized_url",
  "domain",
  "canonical_domain",
  "source_column",
  "first_req_description_excerpt",
  "first_req_note_excerpt",
  "status",
  "elapsed_ms",
  "error_message",
  "extracted_business_name",
  "extracted_business_category",
  "extracted_tagline",
  "extracted_summary",
  "logo_candidate_count",
  "selected_logo_url",
  "pages_inspected",
  "extraction_provider",
  "extraction_model",
  "business_name_score",
  "category_score",
  "logo_score",
  "brief_score",
  "overall_score",
  "reviewer_notes",
  "business_name_similarity_hint",
  "title_business_name_overlap_hint",
] as const;

export type ReviewQueueRow = Record<(typeof REVIEW_QUEUE_COLUMNS)[number], string>;

export type ReviewQueueBuildResult = {
  inputPath: string;
  outputPath: string;
  rowsRead: number;
  reviewRowsWritten: number;
  successCount: number;
  errorCount: number;
  parseErrors: { line: number; message: string }[];
};

const EXCERPT_MAX = 240;

export function excerptText(text: string, max = EXCERPT_MAX): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

export function timestampFromExtractionRunPath(path: string): string | undefined {
  const name = basename(path);
  const m = name.match(/^extraction_run_(20\d{12})\.jsonl$/);
  return m?.[1];
}

export function isSafeExtractionRunPath(path: string): boolean {
  return /extraction_run_20\d{12}\.jsonl$/.test(basename(path));
}

function tokenizeComparable(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  );
}

function overlapHint(a: string, b: string): string {
  const ta = tokenizeComparable(a);
  const tb = tokenizeComparable(b);
  if (!ta.size || !tb.size) return "";
  let overlap = 0;
  for (const t of ta) {
    if (tb.has(t)) overlap += 1;
  }
  const ratio = overlap / Math.max(ta.size, tb.size);
  if (ratio >= 0.5) return "high";
  if (ratio >= 0.2) return "partial";
  return "low";
}

function titleBusinessOverlapHint(title: string, businessName: string): string {
  const t = title.trim().toLowerCase();
  const b = businessName.trim().toLowerCase();
  if (!t || !b) return "";
  if (t.includes(b) || b.includes(t)) return "high";
  return overlapHint(title, businessName);
}

function emptyExpoFields(): Pick<
  ReviewQueueRow,
  | "extracted_business_name"
  | "extracted_business_category"
  | "extracted_tagline"
  | "extracted_summary"
  | "logo_candidate_count"
  | "selected_logo_url"
  | "pages_inspected"
  | "extraction_provider"
  | "extraction_model"
> {
  return {
    extracted_business_name: "",
    extracted_business_category: "",
    extracted_tagline: "",
    extracted_summary: "",
    logo_candidate_count: "",
    selected_logo_url: "",
    pages_inspected: "",
    extraction_provider: "",
    extraction_model: "",
  };
}

function extractExpoFields(
  expo?: DesignIntakeExtractResponse,
): ReturnType<typeof emptyExpoFields> {
  if (!expo) return emptyExpoFields();

  const business = expo.business;
  const brand = expo.brand;
  const designIntake = expo.designIntake;
  const meta = expo.metadata;

  const logos = brand?.logoCandidates ?? [];
  const name = business?.name?.trim() ?? "";
  const headline = designIntake?.recommendedHeadline?.trim() ?? "";
  const supporting = designIntake?.recommendedSupportingText?.trim() ?? "";

  let tagline = "";
  if (headline && headline.toLowerCase() !== name.toLowerCase()) {
    tagline = headline;
  }

  let summary = supporting;
  if (!summary && expo.content) {
    const parts = [
      ...(expo.content.services ?? []),
      ...(expo.content.products ?? []),
    ].filter(Boolean);
    if (parts.length > 0) summary = parts.slice(0, 4).join("; ");
  }

  return {
    extracted_business_name: name,
    extracted_business_category: designIntake?.productCategory?.trim() ?? "",
    extracted_tagline: tagline,
    extracted_summary: summary,
    logo_candidate_count:
      logos.length > 0 ? String(logos.length) : "",
    selected_logo_url: logos[0]?.url?.trim() ?? "",
    pages_inspected:
      typeof meta?.pagesInspected === "number"
        ? String(meta.pagesInspected)
        : "",
    extraction_provider: meta?.source?.trim() ?? "",
    extraction_model: meta?.claude?.model?.trim() ?? "",
  };
}

function isSuccessStatus(status: string): boolean {
  return status === "success";
}

function isErrorStatus(status: string): boolean {
  return (
    status === "fetch_error" ||
    status === "extraction_error" ||
    status === "skipped"
  );
}

export function parseExtractionJsonl(text: string): {
  records: ExtractionJsonlRecord[];
  parseErrors: { line: number; message: string }[];
} {
  const records: ExtractionJsonlRecord[] = [];
  const parseErrors: { line: number; message: string }[] = [];
  const lines = text.split("\n");

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const lineNo = index + 1;
    try {
      const parsed = JSON.parse(trimmed) as ExtractionJsonlRecord;
      records.push(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      parseErrors.push({ line: lineNo, message });
    }
  });

  return { records, parseErrors };
}

export function reviewRowFromExtractionRecord(
  record: ExtractionJsonlRecord,
): ReviewQueueRow {
  const input = record.input;
  const domain = input.domain?.trim() ?? "";
  const canonical =
    input.canonical_domain?.trim() ||
    canonicalDomainFromHost(domain) ||
    "";

  const expo = extractExpoFields(record.expo_output);
  const projectTitle = input.project_title?.trim() ?? "";
  const businessName = expo.extracted_business_name;

  const row = {} as ReviewQueueRow;
  for (const col of REVIEW_QUEUE_COLUMNS) {
    row[col] = "";
  }

  Object.assign(row, {
    ds_number: input.ds_number ?? "",
    ds_id: input.ds_id ?? "",
    project_title: projectTitle,
    project_type: input.project_type ?? "",
    shop_code: input.shop_code ?? "",
    normalized_url: input.normalized_url ?? "",
    domain,
    canonical_domain: canonical,
    source_column: input.source_column ?? "",
    first_req_description_excerpt: excerptText(
      input.first_req_description ?? "",
    ),
    first_req_note_excerpt: excerptText(input.first_req_note ?? ""),
    status: record.status ?? "",
    elapsed_ms: String(record.elapsed_ms ?? ""),
    error_message: record.error_message ?? "",
    ...expo,
    business_name_similarity_hint: overlapHint(projectTitle, businessName),
    title_business_name_overlap_hint: titleBusinessOverlapHint(
      projectTitle,
      businessName,
    ),
  });

  return row;
}

export function reviewQueueToCsv(rows: ReviewQueueRow[]): string {
  const lines = [REVIEW_QUEUE_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(
      REVIEW_QUEUE_COLUMNS.map((col) => escapeCsvCell(row[col] ?? "")).join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function buildReviewQueueFromJsonl(inputPath: string): ReviewQueueBuildResult {
  if (!isSafeExtractionRunPath(inputPath)) {
    throw new Error(
      `Expected extraction_run_<timestamp>.jsonl, got: ${basename(inputPath)}`,
    );
  }

  ensureEvalDirs();
  const text = readFileSync(inputPath, "utf8");
  const { records, parseErrors } = parseExtractionJsonl(text);

  const reviewRows = records.map(reviewRowFromExtractionRecord);

  const runTs = timestampFromExtractionRunPath(inputPath) ?? runTimestampId();
  const outputPath = join(EVAL_RESULTS_DIR, `review_queue_${runTs}.csv`);
  writeFileSync(outputPath, reviewQueueToCsv(reviewRows), "utf8");

  let successCount = 0;
  let errorCount = 0;
  for (const row of reviewRows) {
    if (isSuccessStatus(row.status)) successCount += 1;
    else if (isErrorStatus(row.status)) errorCount += 1;
  }

  return {
    inputPath,
    outputPath,
    rowsRead: records.length,
    reviewRowsWritten: reviewRows.length,
    successCount,
    errorCount,
    parseErrors,
  };
}

export function printReviewQueueSummary(result: ReviewQueueBuildResult): void {
  console.log("Historical review queue");
  console.log(`  Input:  ${result.inputPath}`);
  console.log(`  Rows read:           ${result.rowsRead}`);
  console.log(`  Review rows written: ${result.reviewRowsWritten}`);
  console.log(`  Success:             ${result.successCount}`);
  console.log(`  Errors:              ${result.errorCount}`);
  console.log(`  Output: ${result.outputPath}`);

  if (result.parseErrors.length > 0) {
    console.log("  Parse warnings:");
    for (const err of result.parseErrors) {
      console.log(`    line ${err.line}: ${err.message}`);
    }
  }
}
