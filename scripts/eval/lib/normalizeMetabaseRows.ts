import { readFileSync } from "node:fs";
import { csvRowsToObjects, parseCsv } from "./parseCsv.js";
import { METABASE_URL_COLUMNS, type NormalizedMetabaseRow } from "./types.js";

function headerKeyMap(headers: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const h of headers) {
    map.set(h.trim().toLowerCase(), h);
  }
  return map;
}

function pickField(
  record: Record<string, string>,
  keyMap: Map<string, string>,
  canonical: string,
): string {
  const actual = keyMap.get(canonical);
  if (!actual) return "";
  return (record[actual] ?? "").trim();
}

function normalizeWebsiteUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (t.includes(" ") || !t.includes(".")) return "";
  return `https://${t.replace(/^www\./i, "www.")}`;
}

function resolveWebsiteUrl(
  record: Record<string, string>,
  keyMap: Map<string, string>,
): { url: string; source: string } {
  for (const col of METABASE_URL_COLUMNS) {
    const raw = pickField(record, keyMap, col);
    const url = normalizeWebsiteUrl(raw);
    if (url) return { url, source: col };
  }
  const shop = pickField(record, keyMap, "shop_code");
  const fromShop = normalizeWebsiteUrl(shop);
  if (fromShop) return { url: fromShop, source: "shop_code" };
  return { url: "", source: "" };
}

export function normalizeMetabaseRecords(
  records: Record<string, string>[],
  headers: string[],
): NormalizedMetabaseRow[] {
  const keyMap = headerKeyMap(headers);

  return records.map((record) => {
    const row: NormalizedMetabaseRow = {
      ds_id: pickField(record, keyMap, "ds_id"),
      ds_number: pickField(record, keyMap, "ds_number"),
      project_id: pickField(record, keyMap, "project_id"),
      project_title: pickField(record, keyMap, "project_title"),
      project_status: pickField(record, keyMap, "project_status"),
      project_type: pickField(record, keyMap, "project_type"),
      turnaround_type: pickField(record, keyMap, "turnaround_type"),
      shop_code: pickField(record, keyMap, "shop_code"),
      first_req_description: pickField(record, keyMap, "first_req_description"),
      first_req_note: pickField(record, keyMap, "first_req_note"),
      first_req_created_at: pickField(record, keyMap, "first_req_created_at"),
      ds_age_days: pickField(record, keyMap, "ds_age_days"),
      website_url: "",
      website_url_source: "",
    };

    const { url, source } = resolveWebsiteUrl(record, keyMap);
    row.website_url = url;
    row.website_url_source = source;

    if (!url) {
      row.skip_reason = "missing_url";
    }

    return row;
  });
}

export function loadAndNormalizeMetabaseCsv(csvPath: string): NormalizedMetabaseRow[] {
  const text = readFileSync(csvPath, "utf8");
  const rows = parseCsv(text);
  const { headers, records } = csvRowsToObjects(rows);
  return normalizeMetabaseRecords(records, headers);
}
