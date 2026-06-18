import { canonicalDomainFromHost } from "./canonicalDomain";
import { safeHttpHref } from "./evalRowUrl";
import type { ReviewQueueRow } from "./reviewQueueTypes";
import type { UrlCandidateRow } from "./urlCandidateTypes";

export type ParsedSourceUrlDisplay = {
  href: string | null;
  /** Full URL for tooltip (normalized when available). */
  fullUrl: string;
  host: string;
  pathSuffix: string | null;
};

function domainOnlyHref(domain: string): string | null {
  const host = canonicalDomainFromHost(domain);
  if (!host || host.includes("/") || host.includes(" ")) return null;
  return safeHttpHref(`https://${host}`);
}

function pathSuffixFromParsedUrl(parsed: URL): string | null {
  const pathname = parsed.pathname;
  const search = parsed.search;
  const hash = parsed.hash;
  const hasPath = pathname && pathname !== "/";
  const hasQuery = search.length > 0;
  const hasHash = hash.length > 0;
  if (!hasPath && !hasQuery && !hasHash) return null;
  return `${hasPath ? pathname : ""}${search}${hash}`;
}

function parseUrlLike(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withScheme = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed.replace(/^\/+/, "")}`;
    return new URL(withScheme);
  } catch {
    return null;
  }
}

export function parseSourceUrlDisplay(
  normalizedUrl: string,
  domain?: string,
  canonicalDomain?: string,
): ParsedSourceUrlDisplay {
  const urlTrim = normalizedUrl.trim();
  const domainTrim = domain?.trim() || canonicalDomain?.trim() || "";

  const href =
    safeHttpHref(urlTrim) ||
    (domainTrim ? domainOnlyHref(domainTrim) : null);

  const fullUrl = urlTrim || href || domainTrim || "—";

  let host = domainTrim;
  let pathSuffix: string | null = null;

  const parsed = urlTrim ? parseUrlLike(urlTrim) : null;
  if (parsed) {
    if (!host) host = parsed.host;
    pathSuffix = pathSuffixFromParsedUrl(parsed);
  }

  if (!host) {
    host = urlTrim || "—";
    pathSuffix = null;
  }

  return { href, fullUrl, host, pathSuffix };
}

export function parseSourceUrlDisplayFromReviewRow(
  row: ReviewQueueRow,
): ParsedSourceUrlDisplay {
  const display = parseSourceUrlDisplay(
    row.normalized_url ?? "",
    row.domain,
    row.canonical_domain,
  );
  const normalized = row.normalized_url?.trim();
  return {
    ...display,
    href: safeHttpHref(normalized ?? "") ?? display.href,
    fullUrl: normalized || display.fullUrl,
  };
}

export function parseSourceUrlDisplayFromCandidate(
  candidate: UrlCandidateRow,
): ParsedSourceUrlDisplay {
  const normalized =
    candidate.normalized_url?.trim() || candidate.raw_url?.trim() || "";
  const display = parseSourceUrlDisplay(
    normalized,
    candidate.domain,
    candidate.canonical_domain,
  );
  return {
    ...display,
    href: safeHttpHref(normalized) ?? display.href,
    fullUrl: normalized || display.fullUrl,
  };
}
