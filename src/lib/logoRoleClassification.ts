import type { LogoCandidate, LogoRole } from "@/lib/analyzeWebsiteResponse";
import {
  looksLikeFailoverLogoUrl,
  type LogoRankingContext,
} from "@/lib/logoCandidateRanking";

const LOGOISH_PATH_RE = /logo|brand|mark|identity|wordmark/i;

const LOGOISH_RE = /logo|brand|mark|wordmark/i;
const MARKETING_PATH_RE =
  /enterprise-accordion|nav-bg|testimonial|hero-?bg|case-study|customer-story|sessions-\d/i;

function candidatePath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function candidateBlob(candidate: LogoCandidate): string {
  return `${candidate.url} ${candidate.alt ?? ""}`.toLowerCase();
}

function brandMatch(blob: string, ctx: LogoRankingContext): boolean {
  return ctx.brandTokens.some((t) => {
    if (t.length < 2) return false;
    if (t.length <= 3) {
      return new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
        blob,
      );
    }
    return blob.includes(t);
  });
}

function isSquareish(candidate: LogoCandidate): boolean {
  const { width, height } = candidate;
  if (typeof width !== "number" || typeof height !== "number") return false;
  const ratio = width / height;
  return ratio >= 0.82 && ratio <= 1.22;
}

function looksLikeWordmarkProportions(candidate: LogoCandidate): boolean {
  const { width, height } = candidate;
  if (typeof width !== "number" || typeof height !== "number") return false;
  if (width < 72 || height < 20 || height > 160) return false;
  const ratio = width / height;
  return ratio >= 1.55 && ratio <= 6.5;
}

function isFaviconSource(candidate: LogoCandidate): boolean {
  return (
    candidate.source === "icon" || candidate.source === "apple-touch-icon"
  );
}

function isPrimaryBrandSvg(path: string): boolean {
  return /favicon\.svg(?:$|\?)/i.test(path);
}

function isLogoishPath(path: string): boolean {
  return LOGOISH_RE.test(path);
}

function urlLooksLogoish(url: string): boolean {
  try {
    const u = new URL(url);
    return LOGOISH_PATH_RE.test(`${u.pathname}${u.search}`);
  } catch {
    return LOGOISH_PATH_RE.test(url);
  }
}

function ogImageLooksLogoLike(
  candidate: LogoCandidate,
  ctx: LogoRankingContext,
): boolean {
  if (candidate.source !== "og:image") return false;
  const alt = (candidate.alt ?? "").toLowerCase();
  if (alt.includes("logo")) return true;
  if (urlLooksLogoish(candidate.url)) return true;
  if (brandMatch(candidateBlob(candidate), ctx)) return true;
  const { width, height } = candidate;
  if (
    typeof width === "number" &&
    typeof height === "number" &&
    width >= 40 &&
    width <= 520 &&
    height >= 40 &&
    height <= 520
  ) {
    const ratio = width / height;
    if (ratio >= 0.45 && ratio <= 2.2) return true;
  }
  return false;
}

function looksLikeMarketingImage(candidate: LogoCandidate): boolean {
  const blob = candidateBlob(candidate);
  if (MARKETING_PATH_RE.test(blob)) return true;
  const alt = (candidate.alt ?? "").trim();
  if (candidate.source === "img-logo" && alt.length > 72 && /\blogo\b/i.test(alt)) {
    return true;
  }
  return false;
}

function isVerySmallIcon(candidate: LogoCandidate): boolean {
  const { width, height } = candidate;
  if (typeof width === "number" && typeof height === "number") {
    if (Math.max(width, height) <= 48) return true;
    if (width <= 64 && height <= 64) return true;
  }
  return (
    isFaviconSource(candidate) &&
    /fav[_-]?icon|\/32x32|\/64x64|width=32\b/i.test(candidate.url)
  );
}

/**
 * Classify a logo candidate's likely role for design review (before or after scoring).
 */
export function classifyLogoRole(
  candidate: LogoCandidate,
  ctx: LogoRankingContext = { brandTokens: [] },
): LogoRole {
  const path = candidatePath(candidate.url);
  const blob = candidateBlob(candidate);
  const alt = (candidate.alt ?? "").toLowerCase();
  const brandHit = brandMatch(blob, ctx);

  if (looksLikeFailoverLogoUrl(candidate)) {
    return "social_preview";
  }

  if (looksLikeMarketingImage(candidate)) {
    return "social_preview";
  }

  if (
    candidate.source === "og:image" &&
    !ogImageLooksLogoLike(candidate, ctx)
  ) {
    return "social_preview";
  }

  if (
    candidate.source === "header-image" &&
    !/flags\.svg|\/flags(?:\/|$)/i.test(blob)
  ) {
    if (
      looksLikeWordmarkProportions(candidate) ||
      brandHit ||
      LOGOISH_RE.test(alt) ||
      isLogoishPath(path)
    ) {
      return "wordmark";
    }
    return "wordmark";
  }

  if (
    (candidate.source === "img-logo" || candidate.source === "og:image") &&
    looksLikeWordmarkProportions(candidate) &&
    (brandHit || LOGOISH_RE.test(alt) || isLogoishPath(path))
  ) {
    return "wordmark";
  }

  if (
    candidate.source === "og:image" &&
    ogImageLooksLogoLike(candidate, ctx) &&
    !looksLikeWordmarkProportions(candidate) &&
    isSquareish(candidate)
  ) {
    return "icon_mark";
  }

  if (isPrimaryBrandSvg(path)) {
    return "icon_mark";
  }

  if (
    isFaviconSource(candidate) &&
    (brandHit || isLogoishPath(path) || /\.svg(?:$|\?)/i.test(path))
  ) {
    if (isVerySmallIcon(candidate) && !brandHit && !isPrimaryBrandSvg(path)) {
      return "fallback_icon";
    }
    return "icon_mark";
  }

  if (
    isSquareish(candidate) &&
    (brandHit || isLogoishPath(path) || LOGOISH_RE.test(alt)) &&
    !looksLikeWordmarkProportions(candidate)
  ) {
    const max =
      typeof candidate.width === "number" && typeof candidate.height === "number"
        ? Math.max(candidate.width, candidate.height)
        : undefined;
    if (max !== undefined && max >= 56) return "icon_mark";
  }

  if (isFaviconSource(candidate) || isVerySmallIcon(candidate)) {
    return "fallback_icon";
  }

  if (
    candidate.source === "og:image" &&
    ogImageLooksLogoLike(candidate, ctx)
  ) {
    return looksLikeWordmarkProportions(candidate) ? "wordmark" : "icon_mark";
  }

  if (LOGOISH_RE.test(alt) || isLogoishPath(path)) {
    return looksLikeWordmarkProportions(candidate) ? "wordmark" : "unknown";
  }

  return "unknown";
}

export function logoRoleUiLabel(role: LogoRole | undefined): string {
  switch (role) {
    case "wordmark":
      return "Wordmark";
    case "icon_mark":
      return "Icon mark";
    case "social_preview":
      return "Social preview";
    case "fallback_icon":
      return "Fallback icon";
    case "unknown":
      return "Unknown";
    default:
      return "Unknown";
  }
}

export function selectedLogoRoleNeedsProductionWordmark(
  role: LogoRole | undefined,
): boolean {
  return role === "icon_mark" || role === "fallback_icon";
}
