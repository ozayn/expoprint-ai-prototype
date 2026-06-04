import type { UrlCandidateOutputRow } from "./urlCandidates.js";

export type SelectUrlCandidatesOptions = {
  allowDuplicateDomains: boolean;
  offset: number;
  limit: number;
};

function domainDedupeKey(row: UrlCandidateOutputRow): string {
  const domain = row.domain.trim().toLowerCase();
  if (domain) return domain;
  return row.normalized_url.trim().toLowerCase();
}

export function selectUrlCandidatesForExtraction(
  candidates: UrlCandidateOutputRow[],
  options: SelectUrlCandidatesOptions,
): UrlCandidateOutputRow[] {
  let rows = candidates;

  if (!options.allowDuplicateDomains) {
    const seen = new Set<string>();
    const deduped: UrlCandidateOutputRow[] = [];
    for (const row of rows) {
      const key = domainDedupeKey(row);
      if (!key) {
        deduped.push(row);
        continue;
      }
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(row);
    }
    rows = deduped;
  }

  const { offset, limit } = options;
  if (limit <= 0) return [];
  return rows.slice(offset, offset + limit);
}
