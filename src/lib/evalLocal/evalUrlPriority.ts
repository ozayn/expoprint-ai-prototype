/**
 * URL path priority for eval batch selection and inventory filtering.
 * Lower scores are preferred (root homepages first).
 */

export type UrlPathType = "root" | "shallow" | "deep";

export const URL_PATH_TYPE_LABELS: Record<UrlPathType, string> = {
  root: "Root",
  shallow: "Shallow path",
  deep: "Deep path",
};

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

function normalizedPathname(parsed: URL): string {
  const pathname = parsed.pathname;
  if (!pathname || pathname === "/") return "";
  return pathname.replace(/\/$/, "");
}

function hasMeaningfulQuery(parsed: URL): boolean {
  return parsed.search.length > 1;
}

export function classifyUrlPathType(raw: string): UrlPathType {
  const parsed = parseUrlLike(raw);
  if (!parsed) return "deep";

  const path = normalizedPathname(parsed);
  const hasQuery = hasMeaningfulQuery(parsed);

  if (!path && !hasQuery) return "root";

  const segments = path.split("/").filter(Boolean);
  if (segments.length === 1 && !hasQuery) return "shallow";

  return "deep";
}

export function isRootUrl(raw: string): boolean {
  return classifyUrlPathType(raw) === "root";
}

export function urlPriorityScore(raw: string): number {
  const parsed = parseUrlLike(raw);
  if (!parsed) return Number.MAX_SAFE_INTEGER;

  const type = classifyUrlPathType(raw);
  const typeRank = type === "root" ? 0 : type === "shallow" ? 1_000 : 2_000;

  const path = normalizedPathname(parsed);
  const segments = path.split("/").filter(Boolean);
  const depthScore = segments.length * 100;
  const lengthScore = path.length;
  const queryScore = hasMeaningfulQuery(parsed) ? 500 : 0;

  return typeRank + depthScore + lengthScore + queryScore;
}

export function compareUrlPriority(
  urlA: string,
  urlB: string,
  originalIndexA: number,
  originalIndexB: number,
): number {
  const scoreA = urlPriorityScore(urlA);
  const scoreB = urlPriorityScore(urlB);
  if (scoreA !== scoreB) return scoreA - scoreB;
  return originalIndexA - originalIndexB;
}

export function urlForCandidateFields(
  normalizedUrl: string | undefined,
  rawUrl?: string | undefined,
): string {
  return normalizedUrl?.trim() || rawUrl?.trim() || "";
}

export function countSelectedByPathType(
  urls: string[],
): Record<UrlPathType, number> {
  const counts: Record<UrlPathType, number> = {
    root: 0,
    shallow: 0,
    deep: 0,
  };
  for (const url of urls) {
    counts[classifyUrlPathType(url)] += 1;
  }
  return counts;
}
