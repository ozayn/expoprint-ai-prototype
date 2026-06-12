/** Row shape from `url_candidates_<timestamp>.csv` (eval:urls output). */
export const URL_CANDIDATE_COLUMNS = [
  "ds_id",
  "ds_number",
  "project_id",
  "project_title",
  "project_status",
  "project_type",
  "turnaround_type",
  "shop_code",
  "source_column",
  "raw_url",
  "normalized_url",
  "domain",
  "canonical_domain",
  "first_req_description",
  "first_req_note",
] as const;

export type UrlCandidateRow = Record<(typeof URL_CANDIDATE_COLUMNS)[number], string>;
