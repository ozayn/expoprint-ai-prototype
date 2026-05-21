import type { LogoCandidate } from "@/lib/analyzeWebsiteResponse";

const STRONG_LOGO_SOURCES = new Set<LogoCandidate["source"]>([
  "header-image",
  "img-logo",
]);

export const FAVICON_ONLY_LOGO_WARNING =
  "Only favicon-style logo candidate found; production logo upload recommended.";

export const PRODUCTION_LOGO_UPLOAD_ASSET =
  "Production-quality logo upload recommended";

/** True when URL/path looks like a small favicon, not a header wordmark. */
export function isFaviconStyleLogoCandidate(candidate: LogoCandidate): boolean {
  if (STRONG_LOGO_SOURCES.has(candidate.source)) {
    return false;
  }
  if (candidate.source === "og:image") {
    return !/logo|brand|wordmark/i.test(candidate.url);
  }
  if (
    candidate.source === "icon" ||
    candidate.source === "apple-touch-icon"
  ) {
    if (/\.svg(?:$|\?)/i.test(candidate.url) && /logo|wordmark/i.test(candidate.url)) {
      return false;
    }
    return (
      /\.ico(?:$|\?)/i.test(candidate.url) ||
      /favicon/i.test(candidate.url) ||
      candidate.source === "icon"
    );
  }
  return false;
}

/** All discovered candidates are favicon/apple-touch (no header/wordmark-class asset). */
export function logoCandidatesAreFaviconOnly(
  candidates: LogoCandidate[],
): boolean {
  if (candidates.length === 0) return false;
  return candidates.every((c) => isFaviconStyleLogoCandidate(c));
}
