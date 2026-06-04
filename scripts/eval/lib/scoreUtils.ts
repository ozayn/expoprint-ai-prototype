import type {
  FieldScoreRow,
  HistoricalRunRecord,
  ScoreMethod,
} from "./types.js";

export function normalizeComparable(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

export function scoreExact(
  historical: string,
  extracted: string,
): { score: string; method: ScoreMethod; notes: string } {
  const h = historical.trim();
  const e = extracted.trim();
  if (!h && !e) {
    return { score: "N/A", method: "missing", notes: "both empty" };
  }
  if (!h) {
    return { score: "N/A", method: "missing", notes: "no historical value" };
  }
  if (!e) {
    return { score: "0", method: "missing", notes: "extracted empty" };
  }
  const match =
    normalizeComparable(h) === normalizeComparable(e) ||
    normalizeComparable(e).includes(normalizeComparable(h)) ||
    normalizeComparable(h).includes(normalizeComparable(e));
  return match
    ? { score: "3", method: "exact", notes: "normalized match" }
    : { score: "review", method: "review", notes: "no exact match — assign 0–3 manually" };
}

export function scorePresent(
  historical: string,
  extracted: string,
): { score: string; method: ScoreMethod; notes: string } {
  const e = extracted.trim();
  if (!e) {
    return { score: "0", method: "missing", notes: "extracted missing" };
  }
  if (!historical.trim()) {
    return { score: "review", method: "review", notes: "extracted present; no historical baseline" };
  }
  return { score: "review", method: "present", notes: "extracted present — assign 0–3 manually" };
}

export function scoreReview(notes: string): {
  score: string;
  method: ScoreMethod;
  notes: string;
} {
  return { score: "review", method: "review", notes };
}

export function scoreSkippedRow(record: HistoricalRunRecord): FieldScoreRow[] {
  return [
    {
      run_id: record.run_id,
      ds_id: record.row.ds_id,
      ds_number: record.row.ds_number,
      website_url: record.row.website_url,
      mode: record.mode,
      run_status: record.status,
      field: "_row",
      historical_value: "",
      extracted_value: "",
      score: "N/A",
      score_method: "skipped",
      notes: record.skip_reason ?? "skipped",
    },
  ];
}

function getExtractedBusinessName(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const r = response as { business?: { name?: string } };
  return r.business?.name?.trim() ?? "";
}

function getExtractedDomain(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const r = response as { business?: { domain?: string } };
  return r.business?.domain?.trim() ?? "";
}

function getExtractedHeadline(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const r = response as { designIntake?: { recommendedHeadline?: string } };
  return r.designIntake?.recommendedHeadline?.trim() ?? "";
}

function getLogoCandidateCount(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const r = response as { brand?: { logoCandidates?: unknown[] } };
  const n = r.brand?.logoCandidates?.length;
  return typeof n === "number" ? String(n) : "";
}

function getExtractOk(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const r = response as { ok?: boolean };
  return r.ok === true ? "true" : r.ok === false ? "false" : "";
}

function pushScore(
  out: FieldScoreRow[],
  record: HistoricalRunRecord,
  field: string,
  historical: string,
  extracted: string,
  scored: { score: string; method: ScoreMethod; notes: string },
): void {
  out.push({
    run_id: record.run_id,
    ds_id: record.row.ds_id,
    ds_number: record.row.ds_number,
    website_url: record.row.website_url,
    mode: record.mode,
    run_status: record.status,
    field,
    historical_value: historical,
    extracted_value: extracted,
    score: scored.score,
    score_method: scored.method,
    notes: scored.notes,
  });
}

/** Score one run record — automated checks only; semantic fields marked `review`. */
export function scoreHistoricalRunRecord(record: HistoricalRunRecord): FieldScoreRow[] {
  if (record.status === "skipped") {
    return scoreSkippedRow(record);
  }

  if (record.status === "error" || record.status === "dry_run") {
    return [
      {
        run_id: record.run_id,
        ds_id: record.row.ds_id,
        ds_number: record.row.ds_number,
        website_url: record.row.website_url,
        mode: record.mode,
        run_status: record.status,
        field: "_row",
        historical_value: "",
        extracted_value: record.error_message ?? "",
        score: "N/A",
        score_method: record.status === "dry_run" ? "skipped" : "missing",
        notes:
          record.status === "dry_run"
            ? "dry run — no extraction"
            : record.error_message ?? "error",
      },
    ];
  }

  const response = record.extract_response;
  const rows: FieldScoreRow[] = [];

  pushScore(
    rows,
    record,
    "extract.ok",
    "true",
    getExtractOk(response),
    scoreExact("true", getExtractOk(response)),
  );

  pushScore(
    rows,
    record,
    "business.name",
    record.row.project_title,
    getExtractedBusinessName(response),
    scoreReview("compare project_title to business.name — assign 0–3 manually"),
  );

  pushScore(
    rows,
    record,
    "business.domain",
    record.row.shop_code,
    getExtractedDomain(response),
    scoreExact(record.row.shop_code, getExtractedDomain(response)),
  );

  const reqText = [record.row.first_req_description, record.row.first_req_note]
    .filter(Boolean)
    .join(" | ");

  pushScore(
    rows,
    record,
    "designIntake.recommendedHeadline",
    reqText,
    getExtractedHeadline(response),
    scoreReview("semantic — compare requirement text to recommendedHeadline"),
  );

  pushScore(
    rows,
    record,
    "brand.logoCandidates",
    "",
    getLogoCandidateCount(response),
    scorePresent("", getLogoCandidateCount(response)),
  );

  pushScore(
    rows,
    record,
    "brand.logo",
    "",
    getLogoCandidateCount(response) ? "candidates_present" : "",
    scoreReview("logo quality — manual review of top candidate vs production asset"),
  );

  if (record.mode === "website_plus_requirements") {
    pushScore(
      rows,
      record,
      "customerInstructions",
      reqText,
      record.extract_request?.customerInstructions ?? "",
      scoreReview("mode B — instructions echoed; measure Claude influence manually"),
    );
  }

  return rows;
}

export function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function fieldScoresToCsv(rows: FieldScoreRow[]): string {
  const headers = [
    "run_id",
    "ds_id",
    "ds_number",
    "website_url",
    "mode",
    "run_status",
    "field",
    "historical_value",
    "extracted_value",
    "score",
    "score_method",
    "notes",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.run_id,
        row.ds_id,
        row.ds_number,
        row.website_url,
        row.mode,
        row.run_status,
        row.field,
        row.historical_value,
        row.extracted_value,
        row.score,
        row.score_method,
        row.notes,
      ]
        .map(escapeCsvCell)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}
