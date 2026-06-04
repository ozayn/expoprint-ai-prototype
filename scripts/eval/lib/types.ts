/** Known Metabase export columns (case-insensitive header match). */
export const METABASE_KNOWN_COLUMNS = [
  "ds_id",
  "ds_number",
  "project_id",
  "project_title",
  "project_status",
  "project_type",
  "turnaround_type",
  "shop_code",
  "first_req_description",
  "first_req_note",
  "first_req_created_at",
  "ds_age_days",
] as const;

export const METABASE_URL_COLUMNS = [
  "website_url",
  "url",
  "shop_url",
  "customer_url",
  "domain",
] as const;

export type HistoricalEvalMode = "website_only" | "website_plus_requirements";

export type NormalizedMetabaseRow = {
  ds_id: string;
  ds_number: string;
  project_id: string;
  project_title: string;
  project_status: string;
  project_type: string;
  turnaround_type: string;
  shop_code: string;
  first_req_description: string;
  first_req_note: string;
  first_req_created_at: string;
  ds_age_days: string;
  website_url: string;
  website_url_source: string;
  skip_reason?: string;
};

export type HistoricalRunStatus = "skipped" | "error" | "success" | "dry_run";

export type HistoricalRunRecord = {
  run_id: string;
  mode: HistoricalEvalMode;
  timestamp: string;
  status: HistoricalRunStatus;
  skip_reason?: string;
  error_message?: string;
  duration_ms?: number;
  row: NormalizedMetabaseRow;
  extract_request?: {
    websiteUrl: string;
    productCategory: string;
    stylePreference: string;
    customerInstructions?: string;
  };
  extract_response?: unknown;
};

export type ScoreMethod = "exact" | "present" | "missing" | "review" | "skipped";

export type FieldScoreRow = {
  run_id: string;
  ds_id: string;
  ds_number: string;
  website_url: string;
  mode: HistoricalEvalMode;
  run_status: HistoricalRunStatus;
  field: string;
  historical_value: string;
  extracted_value: string;
  score: string;
  score_method: ScoreMethod;
  notes: string;
};
