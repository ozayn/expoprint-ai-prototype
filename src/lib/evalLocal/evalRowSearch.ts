import type { BrandAuditRow } from "./brandAuditRow";

export function brandAuditSearchHaystack(row: BrandAuditRow): string {
  return [
    row.domain,
    row.canonical_domain,
    row.normalized_url,
    row.project_title,
    row.project_type,
    row.ds_number,
    row.shop_code,
    row.extracted_business_name,
  ]
    .map((v) => (v ?? "").toLowerCase())
    .join(" ");
}

export function matchesSearchQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.includes(q);
}
