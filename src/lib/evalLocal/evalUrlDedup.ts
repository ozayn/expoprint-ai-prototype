const BLOCKED_PROTOCOL = /^(javascript|data|vbscript|file|mailto):/i;

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
] as const;

const TRAILING_PUNCT_RE = /[.,;:!?)\]"']+$/;
const LEADING_PUNCT_RE = /^[(["']+/;

function stripUrlPunctuation(url: string): string {
  let u = url.trim();
  while (TRAILING_PUNCT_RE.test(u)) {
    u = u.replace(TRAILING_PUNCT_RE, "");
  }
  return u.replace(LEADING_PUNCT_RE, "");
}

function sortedSearchString(parsed: URL): string {
  const entries = [...parsed.searchParams.entries()].sort((a, b) => {
    const keyCmp = a[0].localeCompare(b[0]);
    return keyCmp !== 0 ? keyCmp : a[1].localeCompare(b[1]);
  });
  if (entries.length === 0) return "";
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    params.append(key, value);
  }
  return `?${params.toString()}`;
}

function formatNormalizedUrl(parsed: URL): string {
  const protocol = parsed.protocol.toLowerCase();
  const host = parsed.hostname.toLowerCase();

  let pathname = parsed.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.replace(/\/+$/, "");
  }

  const search = sortedSearchString(parsed);
  if (pathname === "/" && !search) {
    return `${protocol}//${host}`;
  }

  return `${protocol}//${host}${pathname}${search}`;
}

/**
 * Normalize a URL for eval deduplication and batch processing.
 * Returns null for empty/invalid URLs.
 */
export function normalizeEvalUrl(raw: string): string | null {
  const trimmed = stripUrlPunctuation(raw);
  if (!trimmed || BLOCKED_PROTOCOL.test(trimmed)) return null;
  if (trimmed.includes("@")) return null;

  let href = trimmed;
  if (!/^https?:\/\//i.test(href)) {
    if (href.includes(" ") || !href.includes(".")) return null;
    href = `https://${href.replace(/^\/+/, "")}`;
  }

  try {
    const parsed = new URL(href);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

    parsed.hash = "";

    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }

    return formatNormalizedUrl(parsed);
  } catch {
    return null;
  }
}

export type EvalUrlDedupeResult<T> = {
  items: T[];
  beforeCount: number;
  afterCount: number;
  duplicatesRemoved: number;
};

/**
 * Deduplicate items by normalized URL. First occurrence wins unless `merge` is provided.
 */
export function dedupeEvalUrls<T>(
  items: T[],
  getUrl: (item: T) => string,
  merge?: (existing: T, duplicate: T) => T,
): EvalUrlDedupeResult<T> {
  const beforeCount = items.length;
  const seen = new Map<string, T>();

  for (const item of items) {
    const key = normalizeEvalUrl(getUrl(item));
    if (!key) continue;

    const existing = seen.get(key);
    if (existing) {
      seen.set(key, merge ? merge(existing, item) : existing);
      continue;
    }

    seen.set(key, item);
  }

  const deduped = [...seen.values()];
  return {
    items: deduped,
    beforeCount,
    afterCount: deduped.length,
    duplicatesRemoved: beforeCount - deduped.length,
  };
}

export function logEvalUrlDedupe(label: string, result: EvalUrlDedupeResult<unknown>): void {
  if (result.duplicatesRemoved <= 0) return;
  console.log(
    `${label}: ${result.beforeCount} URLs before dedupe, ${result.afterCount} after (${result.duplicatesRemoved} duplicates removed)`,
  );
}

/** Deduplicate URL strings; returns one normalized URL per unique target. */
export function uniqueEvalUrls(urls: string[]): string[] {
  return dedupeEvalUrls(urls, (url) => url).items;
}

export function urlDedupeKeyFromFields(
  normalizedUrl?: string,
  rawUrl?: string,
  domain?: string,
): string | null {
  const fromNormalized = normalizeEvalUrl(normalizedUrl ?? "");
  if (fromNormalized) return fromNormalized;
  const fromRaw = normalizeEvalUrl(rawUrl ?? "");
  if (fromRaw) return fromRaw;
  const fromDomain = normalizeEvalUrl(domain ?? "");
  if (fromDomain) return fromDomain;
  return null;
}
