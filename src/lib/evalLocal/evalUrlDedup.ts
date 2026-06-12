const BLOCKED_PROTOCOL = /^(javascript|data|vbscript|file|mailto):/i;

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
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

    parsed.hostname = parsed.hostname.toLowerCase();

    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }
    const search = parsed.searchParams.toString();
    parsed.search = search ? `?${search}` : "";

    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }

    if (parsed.pathname === "/" && !parsed.search && !parsed.hash) {
      return `${parsed.protocol}//${parsed.hostname}`;
    }

    return parsed.href;
  } catch {
    return null;
  }
}

/** Deduplicate URL strings; returns one normalized URL per unique target. */
export function uniqueEvalUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of urls) {
    const normalized = normalizeEvalUrl(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}
