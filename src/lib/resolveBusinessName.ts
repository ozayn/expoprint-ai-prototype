import { DEFAULT_DEMO_BUSINESS_NAME } from "@/lib/designIntakeState";
import type { WebsiteContentExtraction } from "@/lib/server/extractWebsiteContent";

export type BusinessNameSource = "claude" | "title" | "domain" | "none";

export type ResolvedBusinessName = {
  name: string;
  source: BusinessNameSource;
  /** True when the final name came only from domain heuristics. */
  inferredFromDomain: boolean;
};

const GENERIC_TITLE_RE =
  /^(home|homepage|welcome|official\s+site|index|untitled)$/i;

function domainLabelFromHostname(domain: string): string {
  const d = domain.replace(/^www\./i, "").trim();
  if (!d) return "";
  return d.split(".")[0] ?? "";
}

function capitalizeToken(token: string): string {
  if (!token) return "";
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

/**
 * Cautious display name from registrable domain label (e.g. google → Google).
 */
export function nameFromDomainLabel(label: string): string {
  const raw = label.trim().toLowerCase();
  if (!raw) return "";

  if (raw.includes("-") || raw.includes("_")) {
    return raw
      .split(/[-_]+/)
      .filter(Boolean)
      .map(capitalizeToken)
      .join(" ");
  }

  return capitalizeToken(raw);
}

function isBrandLikeTitleSegment(segment: string, domainLabel: string): boolean {
  if (!segment || segment.length < 2) return false;
  if (segment.length > 80) return false;
  if (GENERIC_TITLE_RE.test(segment)) return false;
  if (segment.split(/\s+/).length > 6) return false;
  if (/^(the|a|an)\s+/i.test(segment) && segment.length > 48) return false;

  if (domainLabel) {
    const segLower = segment.toLowerCase().replace(/\s+/g, "");
    const labelLower = domainLabel.toLowerCase();
    if (segLower.includes(labelLower) || labelLower.includes(segLower)) {
      return true;
    }
  }

  if (/[A-Z][a-z]+[A-Z]/.test(segment)) return true;
  if (/^[A-Z][a-zA-Z0-9&.'-]{1,40}$/.test(segment)) return true;

  return false;
}

function brandLikeTitleSegments(raw: string, domainLabel: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const parts = t.split(/\s*[|\-–—:]\s*/).map((p) => p.trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (isBrandLikeTitleSegment(part, domainLabel)) {
      out.push(part);
    }
  }
  return out;
}

function inferBrandLikeNameFromExtraction(
  extraction: WebsiteContentExtraction,
  domainLabel: string,
): string {
  let best = "";
  for (const raw of [
    extraction.homepage.ogTitle,
    extraction.homepage.title,
  ]) {
    for (const segment of brandLikeTitleSegments(raw, domainLabel)) {
      if (segment.length > best.length) {
        best = segment;
      }
    }
  }
  return best.slice(0, 200);
}

/**
 * When intake still uses the demo placeholder, Claude may echo it back — prefer
 * title/og:title/domain fallbacks (same as integration extract without a user name).
 */
export function claudeSuggestedNameForResolution(
  claudeSuggestedName: string | undefined,
  intakeBusinessName?: string,
): string | undefined {
  const c = (claudeSuggestedName ?? "").trim();
  if (!c) return undefined;
  const intake = (intakeBusinessName ?? "").trim();
  const autoFillable =
    intake.length === 0 || intake === DEFAULT_DEMO_BUSINESS_NAME;
  if (!autoFillable) {
    return c;
  }
  if (c === DEFAULT_DEMO_BUSINESS_NAME) return undefined;
  if (intake.length > 0 && c.toLowerCase() === intake.toLowerCase()) {
    return undefined;
  }
  return c;
}

/**
 * Resolve business name with deterministic fallbacks after Claude.
 * 1. Claude suggested name
 * 2. Brand-like og:title / title
 * 3. Cautious name from domain label
 */
export function resolveBusinessName(params: {
  claudeSuggestedName?: string;
  domain: string;
  extraction: WebsiteContentExtraction;
  intakeBusinessName?: string;
}): ResolvedBusinessName {
  const claude =
    claudeSuggestedNameForResolution(
      params.claudeSuggestedName,
      params.intakeBusinessName,
    ) ?? "";

  const domainLabel = domainLabelFromHostname(params.domain);
  const fromTitle = inferBrandLikeNameFromExtraction(
    params.extraction,
    domainLabel,
  );

  if (claude) {
    return { name: claude.slice(0, 200), source: "claude", inferredFromDomain: false };
  }

  if (fromTitle) {
    return { name: fromTitle, source: "title", inferredFromDomain: false };
  }

  const fromDomain = nameFromDomainLabel(domainLabel);
  if (fromDomain) {
    return { name: fromDomain.slice(0, 200), source: "domain", inferredFromDomain: true };
  }

  return { name: "", source: "none", inferredFromDomain: false };
}
