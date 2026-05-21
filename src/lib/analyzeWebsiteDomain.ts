/**
 * Normalize a URL or bare domain for stable equality checks (editor + demo analyze).
 */
export function normalizeDomainForComparison(urlOrDomain: string): string | null {
  const raw = urlOrDomain.trim();
  if (!raw) return null;
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withScheme).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    const bare = raw
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split(/[/?#]/)[0]
      ?.trim()
      .toLowerCase();
    return bare && bare.includes(".") ? bare : null;
  }
}

/**
 * True when the next analyze target is a different site than the last successful analyze.
 * Empty previous domain means first analyze — not treated as a website switch.
 */
export function isNewAnalyzedWebsite(
  previousUrlOrDomain: string | null | undefined,
  nextUrlOrDomain: string | null | undefined,
): boolean {
  const next = normalizeDomainForComparison(nextUrlOrDomain ?? "");
  if (!next) return false;
  const prev = normalizeDomainForComparison(previousUrlOrDomain ?? "");
  if (!prev) return false;
  return prev !== next;
}
