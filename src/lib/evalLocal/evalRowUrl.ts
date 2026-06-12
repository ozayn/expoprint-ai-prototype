import { canonicalDomainFromHost } from "./canonicalDomain";
import { sourceLabelForRow } from "./brandExtractionParse";
import type { ReviewQueueRow } from "./reviewQueueTypes";

const BLOCKED_PROTOCOL = /^(javascript|data|vbscript|file|mailto):/i;

/** Returns a safe http(s) href, or null if invalid or non-web URL. */
export function safeHttpHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || BLOCKED_PROTOCOL.test(trimmed)) return null;

  try {
    const withScheme = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed.replace(/^\/+/, "")}`;

    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.hostname) return null;

    return parsed.href;
  } catch {
    return null;
  }
}

function domainOnlyHref(domain: string): string | null {
  const host = canonicalDomainFromHost(domain);
  if (!host || host.includes("/") || host.includes(" ")) return null;
  return safeHttpHref(`https://${host}`);
}

/** Best openable URL for a review row: normalized_url, else https://domain. */
export function hrefForReviewRow(row: ReviewQueueRow): string | null {
  const fromNormalized = safeHttpHref(row.normalized_url ?? "");
  if (fromNormalized) return fromNormalized;

  const domain = row.domain?.trim() || row.canonical_domain?.trim();
  if (domain) return domainOnlyHref(domain);

  const label = sourceLabelForRow(row);
  if (!label || label === "—" || /^site \d+$/i.test(label)) return null;

  return domainOnlyHref(label) ?? safeHttpHref(label);
}

/** Href for an explicit URL field (e.g. normalized_url in details). */
export function hrefForUrlField(value: string, row?: ReviewQueueRow): string | null {
  const fromValue = safeHttpHref(value);
  if (fromValue) return fromValue;
  if (row) return hrefForReviewRow(row);
  return null;
}
