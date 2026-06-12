import type { DesignIntakeExtractResponse } from "@/lib/designIntakeApiSchema";

export type ExtractionRunStatus =
  | "success"
  | "fetch_error"
  | "extraction_error"
  | "skipped";

export type UrlCandidateExtractionInput = {
  ds_id: string;
  ds_number: string;
  project_title: string;
  project_type: string;
  shop_code: string;
  source_column: string;
  normalized_url: string;
  domain: string;
  canonical_domain: string;
  first_req_description: string;
  first_req_note: string;
};

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
