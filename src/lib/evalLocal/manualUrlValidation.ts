import { canonicalDomainFromHost } from "./canonicalDomain";
import { normalizeEvalUrl } from "./evalUrlDedup";

export const MANUAL_URL_MAX = 25;
export const MANUAL_URL_DELAY_MS = 1000;

const BLOCKED_PROTOCOL = /^(javascript|data|vbscript|file|mailto):/i;

export type ValidatedManualUrl = {
  raw: string;
  normalized_url: string;
  domain: string;
  canonical_domain: string;
};

export type ManualUrlValidationError = {
  line: number;
  raw: string;
  message: string;
};

function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (
    h === "localhost" ||
    h.endsWith(".local") ||
    h.endsWith(".localhost") ||
    h === "[::1]"
  ) {
    return true;
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
  }

  return false;
}

function normalizeManualUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || BLOCKED_PROTOCOL.test(trimmed)) return null;

  let href = trimmed;
  if (!/^https?:\/\//i.test(href)) {
    if (href.includes(" ") || !href.includes(".")) return null;
    href = `https://${href.replace(/^\/+/, "")}`;
  }

  try {
    const parsed = new URL(href);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.hostname) return null;
    if (isPrivateOrLocalHost(parsed.hostname)) return null;
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.href;
  } catch {
    return null;
  }
}

export function parseAndValidateManualUrls(
  urlLines: string[],
  max = MANUAL_URL_MAX,
): {
  valid: ValidatedManualUrl[];
  errors: ManualUrlValidationError[];
  truncated: boolean;
  duplicatesRemoved: number;
} {
  const errors: ManualUrlValidationError[] = [];
  const valid: ValidatedManualUrl[] = [];
  const seenKeys = new Set<string>();
  let duplicatesRemoved = 0;
  const nonEmpty = urlLines
    .map((line, index) => ({ line: index + 1, raw: line.trim() }))
    .filter((entry) => entry.raw.length > 0);

  const truncated = nonEmpty.length > max;
  const capped = truncated ? nonEmpty.slice(0, max) : nonEmpty;

  if (truncated) {
    errors.push({
      line: 0,
      raw: "",
      message: `Only the first ${max} URLs are processed per submission.`,
    });
  }

  for (const entry of capped) {
    const normalized = normalizeManualUrl(entry.raw);
    if (!normalized) {
      errors.push({
        line: entry.line,
        raw: entry.raw,
        message: "Invalid URL. Use http:// or https:// (bare domains become https://).",
      });
      continue;
    }

    const domain = new URL(normalized).hostname.toLowerCase();
    const dedupeKey = normalizeEvalUrl(normalized) ?? normalized;
    if (seenKeys.has(dedupeKey)) {
      duplicatesRemoved += 1;
      continue;
    }
    seenKeys.add(dedupeKey);

    valid.push({
      raw: entry.raw,
      normalized_url: dedupeKey,
      domain,
      canonical_domain: canonicalDomainFromHost(domain),
    });
  }

  return { valid, errors, truncated, duplicatesRemoved };
}
