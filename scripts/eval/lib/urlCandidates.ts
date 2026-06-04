import { readFileSync } from "node:fs";
import { csvRowsToObjects, parseCsv } from "./parseCsv.js";

/** Columns scanned for embedded http(s) URLs and bare domains. */
export const TEXT_SOURCE_COLUMNS = [
  "first_req_description",
  "first_req_note",
  "project_title",
] as const;

/** Direct URL / domain columns (whole-cell values). */
export const DIRECT_URL_COLUMNS = [
  "website_url",
  "url",
  "shop_url",
  "customer_url",
  "domain",
] as const;

export const METABASE_ROW_FIELDS = [
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
] as const;

export type UrlCandidateOutputRow = {
  ds_id: string;
  ds_number: string;
  project_id: string;
  project_title: string;
  project_status: string;
  project_type: string;
  turnaround_type: string;
  shop_code: string;
  source_column: string;
  raw_url: string;
  normalized_url: string;
  domain: string;
  first_req_description: string;
  first_req_note: string;
};

export type UrlExtractionSummary = {
  totalRowsRead: number;
  rowsWithCandidates: number;
  rowsWithoutCandidates: number;
  totalCandidates: number;
  uniqueDomains: number;
  bySourceColumn: Record<string, number>;
};

const HTTP_URL_IN_TEXT_RE =
  /https?:\/\/[^\s<>"']+/gi;

const EMAIL_RE =
  /\b[a-z0-9._%+-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+\b/gi;

const TRAILING_PUNCT_RE = /[.,;:!?)\]"']+$/;
const LEADING_PUNCT_RE = /^[(["']+/;

/** Conservative gTLDs / common ccTLDs for bare-domain detection (not file extensions). */
const BARE_DOMAIN_TLD =
  "com|org|net|co|io|edu|gov|us|uk|ca|au|de|fr|biz|info|shop|store|app|dev|ai|me|tv|cc|xyz";

const LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";

const WWW_BARE_DOMAIN_RE = new RegExp(
  `\\bwww\\.(${LABEL}\\.(?:${BARE_DOMAIN_TLD}))\\b`,
  "gi",
);

const BARE_DOMAIN_RE = new RegExp(
  `\\b(${LABEL}\\.(?:${BARE_DOMAIN_TLD}))\\b`,
  "gi",
);

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

function rowIdentity(
  base: Pick<UrlCandidateOutputRow, "ds_id" | "ds_number">,
  fallbackIndex: number,
): string {
  return base.ds_id || base.ds_number || `row-${fallbackIndex}`;
}

/** Strip trailing punctuation often glued to URLs in requirement text. */
export function stripTrailingUrlPunctuation(url: string): string {
  let u = url.trim();
  while (TRAILING_PUNCT_RE.test(u)) {
    u = u.replace(TRAILING_PUNCT_RE, "");
  }
  return u;
}

function stripLeadingUrlPunctuation(url: string): string {
  return url.replace(LEADING_PUNCT_RE, "");
}

/** Lowercase hostname; preserve path, query, and hash. */
export function normalizeUrl(raw: string): string | null {
  const trimmed = stripLeadingUrlPunctuation(stripTrailingUrlPunctuation(raw.trim()));
  if (!trimmed) return null;
  if (trimmed.includes("@")) return null;

  let href = trimmed;
  if (!/^https?:\/\//i.test(href)) {
    if (href.includes(" ") || !href.includes(".")) return null;
    href = `https://${href.replace(/^\/+/, "")}`;
  }

  try {
    const parsed = new URL(href);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.href;
  } catch {
    return null;
  }
}

export function domainFromNormalizedUrl(normalized: string): string {
  try {
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** Second-level label must include a letter (avoids numeric-only fragments). */
export function isValidBareDomainHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  const parts = h.split(".").filter(Boolean);
  if (parts.length < 2) return false;
  const tld = parts[parts.length - 1];
  if (!new RegExp(`^(?:${BARE_DOMAIN_TLD})$`, "i").test(tld)) return false;
  const sld = parts[parts.length - 2];
  if (!sld || !/[a-z]/.test(sld)) return false;
  if (/^\d+$/.test(sld)) return false;
  if (parts.some((p) => p.length > 63 || p.length === 0)) return false;
  return true;
}

/** Mask http(s) URLs and emails so bare-domain regex does not double-count or match email hosts. */
export function maskUrlAndEmailSpans(text: string): string {
  let masked = text;
  masked = masked.replace(HTTP_URL_IN_TEXT_RE, (m) => " ".repeat(m.length));
  masked = masked.replace(EMAIL_RE, (m) => " ".repeat(m.length));
  return masked;
}

function extractHttpUrlsFromText(text: string): string[] {
  if (!text.trim()) return [];
  const found: string[] = [];
  const re = new RegExp(HTTP_URL_IN_TEXT_RE.source, HTTP_URL_IN_TEXT_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    found.push(match[0]);
  }
  return found;
}

function extractBareDomainsFromText(text: string): string[] {
  if (!text.trim()) return [];
  const masked = maskUrlAndEmailSpans(text);
  const found: string[] = [];
  const seen = new Set<string>();

  for (const re of [WWW_BARE_DOMAIN_RE, BARE_DOMAIN_RE]) {
    const r = new RegExp(re.source, re.flags);
    let match: RegExpExecArray | null;
    while ((match = r.exec(masked)) !== null) {
      const host = match[1] ?? match[0];
      const raw = match[0].startsWith("www.") ? match[0] : host;
      const cleaned = stripTrailingUrlPunctuation(raw);
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      if (!isValidBareDomainHost(cleaned.replace(/^www\./i, ""))) continue;
      seen.add(key);
      found.push(cleaned);
    }
  }

  return found;
}

export function extractUrlsFromText(text: string): string[] {
  const http = extractHttpUrlsFromText(text);
  const bare = extractBareDomainsFromText(text);
  return [...http, ...bare];
}

function appendSourceColumn(existing: string, next: string): string {
  if (!existing) return next;
  const parts = existing.split("; ").map((s) => s.trim());
  if (parts.includes(next)) return existing;
  return `${existing}; ${next}`;
}

export function buildUrlExtractionSummary(
  totalRowsRead: number,
  candidates: UrlCandidateOutputRow[],
): UrlExtractionSummary {
  const rowKeys = new Set<string>();
  const domains = new Set<string>();
  const bySourceColumn: Record<string, number> = {};

  for (const row of candidates) {
    const rk = row.ds_id || row.ds_number;
    if (rk) rowKeys.add(rk);
    if (row.domain) domains.add(row.domain);
    for (const col of row.source_column.split("; ").map((s) => s.trim())) {
      if (!col) continue;
      bySourceColumn[col] = (bySourceColumn[col] ?? 0) + 1;
    }
  }

  const rowsWithCandidates = rowKeys.size;

  return {
    totalRowsRead,
    rowsWithCandidates,
    rowsWithoutCandidates: Math.max(0, totalRowsRead - rowsWithCandidates),
    totalCandidates: candidates.length,
    uniqueDomains: domains.size,
    bySourceColumn,
  };
}

export function extractUrlCandidatesFromRecords(
  records: Record<string, string>[],
  headers: string[],
): UrlCandidateOutputRow[] {
  const keyMap = headerKeyMap(headers);
  const out: UrlCandidateOutputRow[] = [];
  /** One normalized URL per design-service row; merge source_column when duplicated. */
  const seenPerRow = new Map<string, UrlCandidateOutputRow>();

  records.forEach((record, recordIndex) => {
    const base = {
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
    };

    const rowKey = rowIdentity(base, recordIndex);

    const pushCandidate = (sourceColumn: string, raw: string) => {
      const normalized = normalizeUrl(raw);
      if (!normalized) return;
      const dedupeKey = `${rowKey}|${normalized}`;
      const existing = seenPerRow.get(dedupeKey);
      if (existing) {
        existing.source_column = appendSourceColumn(
          existing.source_column,
          sourceColumn,
        );
        return;
      }
      const row: UrlCandidateOutputRow = {
        ...base,
        source_column: sourceColumn,
        raw_url: raw.trim(),
        normalized_url: normalized,
        domain: domainFromNormalizedUrl(normalized),
      };
      seenPerRow.set(dedupeKey, row);
      out.push(row);
    };

    for (const col of TEXT_SOURCE_COLUMNS) {
      const text = pickField(record, keyMap, col);
      for (const raw of extractUrlsFromText(text)) {
        pushCandidate(col, raw);
      }
    }

    for (const col of DIRECT_URL_COLUMNS) {
      const raw = pickField(record, keyMap, col);
      if (!raw) continue;
      pushCandidate(col, raw);
    }
  });

  return out;
}

export function loadUrlCandidatesFromCsv(csvPath: string): {
  candidates: UrlCandidateOutputRow[];
  summary: UrlExtractionSummary;
} {
  const text = readFileSync(csvPath, "utf8");
  const rows = parseCsv(text);
  const { headers, records } = csvRowsToObjects(rows);
  const candidates = extractUrlCandidatesFromRecords(records, headers);
  const summary = buildUrlExtractionSummary(records.length, candidates);
  return { candidates, summary };
}

export function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function urlCandidatesToCsv(rows: UrlCandidateOutputRow[]): string {
  const headers = [
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
    "first_req_description",
    "first_req_note",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      headers
        .map((h) => escapeCsvCell(row[h as keyof UrlCandidateOutputRow] ?? ""))
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function printUrlExtractionSummary(summary: UrlExtractionSummary): void {
  console.log("Summary");
  console.log(`  Total rows read:           ${summary.totalRowsRead}`);
  console.log(`  Rows with URL candidates:  ${summary.rowsWithCandidates}`);
  console.log(`  Rows without URL:          ${summary.rowsWithoutCandidates}`);
  console.log(`  Total candidates:          ${summary.totalCandidates}`);
  console.log(`  Unique domains:            ${summary.uniqueDomains}`);
  const sources = Object.entries(summary.bySourceColumn).sort(
    (a, b) => b[1] - a[1],
  );
  if (sources.length > 0) {
    console.log("  By source column:");
    for (const [col, count] of sources) {
      console.log(`    ${col}: ${count}`);
    }
  }
}
