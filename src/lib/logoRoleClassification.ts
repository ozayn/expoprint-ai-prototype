import type { LogoCandidate, LogoRole } from "@/lib/analyzeWebsiteResponse";
import type { LogoRankingContext } from "@/lib/logoCandidateRanking";

const FAILOVER_LOGO_PATH_RE =
  /sitefailover|sitedown|botfailover|failover.*\/images\//i;

function looksLikeFailoverLogoUrl(candidate: LogoCandidate): boolean {
  try {
    const u = new URL(candidate.url);
    const blob = `${u.pathname}${u.search}`.toLowerCase();
    return FAILOVER_LOGO_PATH_RE.test(blob);
  } catch {
    return FAILOVER_LOGO_PATH_RE.test(candidate.url.toLowerCase());
  }
}

function socialContentCdnHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (SOCIAL_CONTENT_CDN_HOST_RE.test(host)) return true;
  if (/^scontent[-.]/.test(host) || host.includes("scontent-")) return true;
  return false;
}

/**
 * Scraped feed/preview thumbnails from Instagram and similar social CDNs —
 * not usable logo assets even when they appear in header/og:image slots.
 */
export function looksLikeSocialMediaContentThumbnail(
  candidate: LogoCandidate,
): boolean {
  let host = "";
  let path = "";
  try {
    const u = new URL(candidate.url);
    host = u.hostname.toLowerCase();
    path = `${u.pathname}${u.search}`.toLowerCase();
  } catch {
    return false;
  }

  const onSocialCdn = socialContentCdnHost(host);

  if (
    (candidate.source === "icon" || candidate.source === "apple-touch-icon") &&
    !host.includes("scontent") &&
    !SOCIAL_MEDIA_THUMBNAIL_PATH_RE.test(path)
  ) {
    return false;
  }

  if (ICON_ONLY_PATH_RE.test(path) || /\/images\/ico\//i.test(path)) {
    return false;
  }

  if (pathHasStrongLogoEvidence(path) && !onSocialCdn) {
    return false;
  }

  if (SOCIAL_MEDIA_THUMBNAIL_PATH_RE.test(path) && onSocialCdn) {
    return true;
  }

  if (!onSocialCdn) return false;

  if (
    (candidate.source === "og:image" || candidate.source === "header-image") &&
    !pathHasStrongLogoEvidence(path)
  ) {
    return true;
  }

  if (SOCIAL_RANDOM_RASTER_EXT_RE.test(path) && !pathHasStrongLogoEvidence(path)) {
    return true;
  }

  return false;
}

const LOGOISH_PATH_RE = /logo|brand|mark|identity|wordmark|primary[_-]?logo/i;

const LOGOISH_ALT_RE = /\blogo\b|wordmark/i;

const PRIMARY_LOGO_PATH_RE =
  /primary[_-]?logo|logo[_-]primary[_-]?logo|(?:^|\/)[^/]*[_-]logo[_-]|site[_-]?logo|brand[_-]?mark|wordmark|full[_-]?logo|horizontal[_-]?logo/i;

/** Full brand wordmark assets in CDN/CMS paths — not compact icons. */
const FULL_WORDMARK_PATH_RE =
  /primary[_-]?logo|logo[_-]primary[_-]?logo|wordmark|full[_-]?logo|horizontal[_-]?logo/i;

const ICON_ONLY_PATH_RE =
  /favicon|apple[_-]?touch(?:[_-]?icon)?|app[_-]?icon|icon[_-]?\d|\/icons?(?:\/|$)|\/32x32|\/64x64/i;

const MARKETING_PATH_RE =
  /enterprise-accordion|nav-bg|testimonial|hero-?bg|case-study|customer-story|sessions-\d/i;

/** User-generated / feed media on social CDNs — not brand logo assets. */
const SOCIAL_CONTENT_CDN_HOST_RE =
  /(?:^|\.)cdninstagram\.com$|(?:^|\.)fbcdn\.net$|(?:^|\.)twimg\.com$/i;

const SOCIAL_MEDIA_THUMBNAIL_PATH_RE =
  /\/(?:media|photos?|videos?|stories|reels?|p\/|t51\.|t52\.|e15\/|e35\/)/i;

const SOCIAL_RANDOM_RASTER_EXT_RE = /\.(?:webp|jpe?g)(?:$|\?)/i;

/** Promo / hero copy in alt — not brand wordmarks. */
const MARKETING_ALT_RE =
  /\b(get started|switch to|world'?s best|learn more|try free|sign up|free trial|background|hero\b|hero image|sessions\b|testimonial|accordion|customer story|case study|bento|platform graphic|annual letter|overhead view|delivery bag|boutique|kiosk|newspaper)\b/i;

const PHOTO_CAPTION_ALT_RE =
  /\b(view of|overhead|aerial|exterior|street view|imitating|forms a|crosswalk|showcasing)\b/i;

function candidatePath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function normalizeAltText(alt: string): string {
  return alt.replace(/\s+/g, " ").trim().toLowerCase();
}

function brandTokenMatchesText(text: string, token: string): boolean {
  if (token.length < 2) return false;
  if (token.length <= 3) {
    return new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
      text,
    );
  }
  return text.includes(token);
}

function altMatchesBusinessName(alt: string, ctx: LogoRankingContext): boolean {
  const normalized = normalizeAltText(alt);
  if (!normalized) return false;
  for (const token of ctx.brandTokens) {
    if (token.length < 2) continue;
    if (normalized === token) return true;
    if (normalized === `${token} logo` || normalized === `${token} wordmark`) {
      return true;
    }
    if (
      normalized.length <= token.length + 12 &&
      brandTokenMatchesText(normalized, token) &&
      !MARKETING_ALT_RE.test(normalized)
    ) {
      const words = normalized.split(/\s+/);
      if (words.length <= 4 && words[0] === token) return true;
    }
  }
  return false;
}

/** Alt explicitly names a logo (not a long marketing scene caption). */
export function altHasLogoKeyword(alt: string): boolean {
  const normalized = normalizeAltText(alt);
  if (!normalized || !LOGOISH_ALT_RE.test(normalized)) return false;
  if (PHOTO_CAPTION_ALT_RE.test(normalized)) return false;
  if (normalized.length > 72 && !/\blogo\b/i.test(normalized)) return false;
  return true;
}

/** Promo, hero, or descriptive scene copy — not a wordmark. */
export function altLooksLikeMarketingCopy(alt: string): boolean {
  const normalized = normalizeAltText(alt);
  if (!normalized) return false;
  if (MARKETING_ALT_RE.test(normalized)) return true;
  if (/^switch to\b/i.test(normalized)) return true;
  if (PHOTO_CAPTION_ALT_RE.test(normalized)) return true;
  if (normalized.length > 55 && !LOGOISH_ALT_RE.test(normalized)) return true;
  if (normalized.length > 72 && LOGOISH_ALT_RE.test(normalized)) return true;
  return false;
}

export function pathHasStrongLogoEvidence(path: string): boolean {
  if (MARKETING_PATH_RE.test(path)) return false;
  return (
    pathHasFullWordmarkPathEvidence(path) ||
    PRIMARY_LOGO_PATH_RE.test(path) ||
    pathHasBrandAssetsLogo(path) ||
    LOGOISH_PATH_RE.test(path)
  );
}

function pathHasBrandAssetsLogo(path: string): boolean {
  return /brand[_-]?assets/i.test(path) && LOGOISH_PATH_RE.test(path);
}

/** Path clearly names a full horizontal/wordmark logo file (not a favicon/app icon). */
export function pathHasFullWordmarkPathEvidence(path: string): boolean {
  if (MARKETING_PATH_RE.test(path)) return false;
  return FULL_WORDMARK_PATH_RE.test(path) || pathHasBrandAssetsLogo(path);
}

/** Compact icon / favicon — not a full wordmark asset even when logo-ish. */
function isClearlyIconLikeCandidate(candidate: LogoCandidate): boolean {
  const path = candidatePath(candidate.url);
  if (pathHasFullWordmarkPathEvidence(path)) return false;

  if (isFaviconSource(candidate)) return true;
  if (ICON_ONLY_PATH_RE.test(path)) return true;
  if (isPrimaryBrandSvg(path)) return true;

  const { width, height } = candidate;
  if (typeof width === "number" && typeof height === "number") {
    const max = Math.max(width, height);
    if (max <= 64 && isSquareish(candidate)) return true;
  }

  if (
    isSquareish(candidate) &&
    !looksLikeWordmarkProportions(candidate) &&
    pathHasStrongLogoEvidence(path)
  ) {
    const max =
      typeof width === "number" && typeof height === "number"
        ? Math.max(width, height)
        : undefined;
    if (max !== undefined && max >= 56) return true;
  }

  return false;
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

function ogImageLooksLogoLike(
  candidate: LogoCandidate,
  ctx: LogoRankingContext,
): boolean {
  if (candidate.source !== "og:image") return false;
  if (looksLikeSocialMediaContentThumbnail(candidate)) return false;
  const alt = candidate.alt ?? "";
  if (altLooksLikeMarketingCopy(alt)) return false;
  if (altHasLogoKeyword(alt)) return true;
  const path = candidatePath(candidate.url);
  if (pathHasStrongLogoEvidence(path)) return true;
  if (altMatchesBusinessName(alt, ctx)) return true;
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
    if (ratio >= 0.45 && ratio <= 2.2 && pathHasStrongLogoEvidence(path)) {
      return true;
    }
  }
  return false;
}

export function candidateLooksLikeMarketingImage(
  candidate: LogoCandidate,
): boolean {
  if (looksLikeSocialMediaContentThumbnail(candidate)) return true;
  const path = candidatePath(candidate.url);
  const alt = candidate.alt ?? "";
  if (MARKETING_PATH_RE.test(path)) return true;
  if (altLooksLikeMarketingCopy(alt)) return true;
  if (
    candidate.source === "img-logo" &&
    alt.length > 72 &&
    /\blogo\b/i.test(alt)
  ) {
    return true;
  }
  return false;
}

/**
 * Strong evidence this asset is a real brand logo/wordmark — not header promo art.
 */
export function hasStrongWordmarkEvidence(
  candidate: LogoCandidate,
  ctx: LogoRankingContext = { brandTokens: [] },
): boolean {
  if (looksLikeSocialMediaContentThumbnail(candidate)) return false;
  if (candidateLooksLikeMarketingImage(candidate)) return false;
  if (looksLikeFailoverLogoUrl(candidate)) return false;

  const path = candidatePath(candidate.url);
  const alt = candidate.alt ?? "";

  if (
    pathHasFullWordmarkPathEvidence(path) &&
    !altLooksLikeMarketingCopy(alt) &&
    !isClearlyIconLikeCandidate(candidate)
  ) {
    return true;
  }

  if (pathHasStrongLogoEvidence(path) && !altLooksLikeMarketingCopy(alt)) {
    if (
      candidate.source === "img-logo" ||
      candidate.source === "icon" ||
      candidate.source === "apple-touch-icon" ||
      isPrimaryBrandSvg(path)
    ) {
      return true;
    }
    if (
      (candidate.source === "header-image" || candidate.source === "og:image") &&
      (altMatchesBusinessName(alt, ctx) ||
        altHasLogoKeyword(alt) ||
        looksLikeWordmarkProportions(candidate))
    ) {
      return true;
    }
    if (
      candidate.source === "header-image" &&
      looksLikeWordmarkProportions(candidate) &&
      PRIMARY_LOGO_PATH_RE.test(path)
    ) {
      return true;
    }
  }

  if (altMatchesBusinessName(alt, ctx)) return true;

  if (altHasLogoKeyword(alt)) return true;

  if (
    candidate.source === "header-image" &&
    (altMatchesBusinessName(alt, ctx) || altHasLogoKeyword(alt))
  ) {
    return true;
  }

  if (
    (candidate.source === "img-logo" || candidate.source === "og:image") &&
    looksLikeWordmarkProportions(candidate) &&
    (altMatchesBusinessName(alt, ctx) ||
      altHasLogoKeyword(alt) ||
      pathHasStrongLogoEvidence(path))
  ) {
    return true;
  }

  return false;
}

/**
 * Classify a logo candidate's likely role for design review (before or after scoring).
 */
export function classifyLogoRole(
  candidate: LogoCandidate,
  ctx: LogoRankingContext = { brandTokens: [] },
): LogoRole {
  const path = candidatePath(candidate.url);
  const alt = candidate.alt ?? "";

  if (looksLikeFailoverLogoUrl(candidate)) {
    return "social_preview";
  }

  if (looksLikeSocialMediaContentThumbnail(candidate)) {
    return "social_preview";
  }

  if (candidateLooksLikeMarketingImage(candidate)) {
    return "marketing_image";
  }

  if (
    candidate.source === "og:image" &&
    !ogImageLooksLogoLike(candidate, ctx)
  ) {
    return "social_preview";
  }

  if (hasStrongWordmarkEvidence(candidate, ctx)) {
    return "wordmark";
  }

  if (
    pathHasFullWordmarkPathEvidence(path) &&
    !altLooksLikeMarketingCopy(alt) &&
    !isClearlyIconLikeCandidate(candidate)
  ) {
    return "wordmark";
  }

  if (
    candidate.source === "og:image" &&
    ogImageLooksLogoLike(candidate, ctx) &&
    !looksLikeWordmarkProportions(candidate) &&
    isSquareish(candidate) &&
    !pathHasFullWordmarkPathEvidence(path)
  ) {
    return "icon_mark";
  }

  if (isPrimaryBrandSvg(path)) {
    return "icon_mark";
  }

  const brandInPath = ctx.brandTokens.some((t) =>
    t.length >= 3 ? path.includes(t) : false,
  );

  if (
    isFaviconSource(candidate) &&
    (pathHasStrongLogoEvidence(path) || brandInPath) &&
    /\.svg(?:$|\?)/i.test(path)
  ) {
    return "icon_mark";
  }

  if (
    isFaviconSource(candidate) &&
    (pathHasStrongLogoEvidence(path) || brandInPath)
  ) {
    if (
      typeof candidate.width === "number" &&
      typeof candidate.height === "number" &&
      Math.max(candidate.width, candidate.height) <= 48 &&
      !isPrimaryBrandSvg(path)
    ) {
      return "fallback_icon";
    }
    return "icon_mark";
  }

  if (
    isSquareish(candidate) &&
    pathHasStrongLogoEvidence(path) &&
    !looksLikeWordmarkProportions(candidate) &&
    !pathHasFullWordmarkPathEvidence(path) &&
    isClearlyIconLikeCandidate(candidate)
  ) {
    const max =
      typeof candidate.width === "number" && typeof candidate.height === "number"
        ? Math.max(candidate.width, candidate.height)
        : undefined;
    if (max !== undefined && max >= 56) return "icon_mark";
  }

  if (isFaviconSource(candidate)) {
    return "fallback_icon";
  }

  if (
    candidate.source === "og:image" &&
    ogImageLooksLogoLike(candidate, ctx) &&
    !pathHasFullWordmarkPathEvidence(path)
  ) {
    return "icon_mark";
  }

  if (
    candidate.source === "header-image" &&
    !/flags\.svg|\/flags(?:\/|$)/i.test(path)
  ) {
    return "unknown";
  }

  if (pathHasStrongLogoEvidence(path) && !altLooksLikeMarketingCopy(alt)) {
    return "unknown";
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
    case "marketing_image":
      return "Marketing image";
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
