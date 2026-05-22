import type {
  LogoCandidate,
  LogoCandidateSource,
  LogoCandidateTransparency,
} from "@/lib/analyzeWebsiteResponse";
import { isFaviconStyleLogoCandidate } from "@/lib/logoCandidateQuality";
import {
  altHasLogoKeyword,
  altLooksLikeMarketingCopy,
  candidateLooksLikeMarketingImage,
  classifyLogoRole,
  hasStrongWordmarkEvidence,
  logoRoleUiLabel,
  pathHasStrongLogoEvidence,
} from "@/lib/logoRoleClassification";

export type ScoredLogoCandidate = LogoCandidate & {
  score: number;
  transparency: LogoCandidateTransparency;
  reason?: string;
};

/** Hints for brand/wordmark matching (hostname, page title, optional business name). */
export type LogoRankingContext = {
  brandTokens: string[];
};

const LOGOISH_PATH_RE = /logo|brand|mark|identity|wordmark/i;
const JPEG_EXT_RE = /\.(jpe?g)(?:$|\?)/i;
const SVG_EXT_RE = /\.svg(?:$|\?)/i;
const PNG_EXT_RE = /\.png(?:png)?(?:$|\?)/i;
const WEBP_EXT_RE = /\.webp(?:$|\?)/i;

const PRODUCT_APP_HINT_RE =
  /\b(chrome|chromium|docs?|documents|sheets|slides|maps|youtube|gmail|android|workspace|playstore|play-store|app-store|drive|calendar|meet|photos|news|wallet|pay|assistant|gemini|earth|translate|classroom|keep|podcasts|wear|fit|chat|hangouts|duo|voice|contacts|lens|arts|books|games|pixel|nest|fi\b|tv\b|one\b|account|myaccount|product|app-icon|appicon|sprite|favicon-\d)\b/i;

const PRODUCT_PATH_RE =
  /\/(chrome|docs|sheets|slides|maps|youtube|gmail|android|workspace|drive|calendar|meet|photos|news|play|store|apps?|products?|images\/branding\/product|intl\/[a-z]{2}\/about\/products)\//i;

/** CMS modules, nav promos, case-study art — not primary wordmarks. */
const MARKETING_OR_CUSTOMER_PATH_RE =
  /enterprise-accordion|nav-bg|nav_background|sessions-\d|testimonial|headshot|case-study|customer-story|hero-?bg|bento|platform-graphic|annual-letter|the-happenings|lovable\.png|runway\.png|supabase\.png/i;

/** CDN failover / bot-wall pages that serve HTML for `.png` paths. */
export const FAILOVER_LOGO_PATH_RE =
  /sitefailover|sitedown|botfailover|failover.*\/images\//i;

export function looksLikeFailoverLogoUrl(candidate: LogoCandidate): boolean {
  return FAILOVER_LOGO_PATH_RE.test(candidatePathBlob(candidate));
}

/** Long photo captions that mention "logo" or the brand incidentally (e.g. Stripe homepage). */
const PHOTO_CAPTION_ALT_RE =
  /\b(view of|overhead|aerial|exterior|street view|imitating|forms a|crosswalk|showcasing|delivery bag|boutique|kiosk|window display|door stoop|newspaper)\b/i;

const PRIMARY_BRAND_MARK_PATH_RE =
  /(?:^|\/)(?:favicon\.svg|logo(?:[_-]|\.|$)|wordmark|brand[_-]?mark|site[_-]?logo|stripe[_-]?logo)/i;

const TITLE_STOPWORDS = new Set([
  "home",
  "official",
  "site",
  "website",
  "welcome",
  "the",
  "and",
  "for",
  "inc",
  "llc",
  "ltd",
  "corp",
  "co",
]);

export function brandTokensFromHostname(url: string): string[] {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    const label = host.split(".")[0] ?? "";
    if (label.length >= 3 && !TITLE_STOPWORDS.has(label)) {
      return [label];
    }
    if (label.length >= 2 && label.length <= 2) {
      return [label];
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function brandTokensFromTitles(...titles: string[]): string[] {
  const tokens = new Set<string>();
  for (const raw of titles) {
    const t = raw.replace(/\s+/g, " ").trim().toLowerCase();
    if (!t) continue;
    const beforeDash = t.split(/\s*[|\-–—]\s*/)[0] ?? t;
    for (const word of beforeDash.split(/[^a-z0-9]+/)) {
      const w = word.trim();
      if (w.length < 2 || TITLE_STOPWORDS.has(w)) continue;
      tokens.add(w);
    }
  }
  return [...tokens];
}

export function buildLogoRankingContext(options: {
  finalUrl?: string;
  pageTitle?: string;
  ogTitle?: string;
  businessName?: string;
}): LogoRankingContext {
  const tokens = new Set<string>();
  if (options.finalUrl) {
    for (const t of brandTokensFromHostname(options.finalUrl)) tokens.add(t);
  }
  for (const t of brandTokensFromTitles(
    options.pageTitle ?? "",
    options.ogTitle ?? "",
    options.businessName ?? "",
  )) {
    tokens.add(t);
  }
  return { brandTokens: [...tokens] };
}

function fileExtension(url: string): string {
  try {
    const path = new URL(url).pathname.toLowerCase();
    const match = path.match(/\.([a-z0-9]+)(?:$|\?)/i);
    return match?.[1] ?? "";
  } catch {
    return "";
  }
}

function candidateTextBlob(candidate: LogoCandidate): string {
  return `${candidate.url} ${candidate.alt ?? ""}`.toLowerCase();
}

/** Path + alt only — avoids treating the site hostname as brand evidence on every URL. */
function candidateBrandBlob(candidate: LogoCandidate): string {
  const alt = (candidate.alt ?? "").toLowerCase();
  const path = candidatePathBlob(candidate);
  return alt ? `${alt} ${path}` : path;
}

function candidatePathBlob(candidate: LogoCandidate): string {
  try {
    const u = new URL(candidate.url);
    const path = u.pathname.toLowerCase();
    const search = u.search.toLowerCase();
    return search ? `${path} ${search}` : path;
  } catch {
    return candidate.url.toLowerCase();
  }
}

function altLooksLikeMarketingPhotoCaption(alt: string): boolean {
  const trimmed = alt.replace(/\s+/g, " ").trim();
  if (!trimmed) return false;
  if (PHOTO_CAPTION_ALT_RE.test(trimmed)) return true;
  if (trimmed.length > 72 && /\blogo\b/i.test(trimmed)) return true;
  return false;
}

function urlLooksLogoish(url: string): boolean {
  try {
    const u = new URL(url);
    return LOGOISH_PATH_RE.test(`${u.pathname}${u.search}`);
  } catch {
    return LOGOISH_PATH_RE.test(url);
  }
}

function brandTokenMatches(blob: string, token: string): boolean {
  if (token.length < 2) return false;
  if (token.length <= 3) {
    return new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
      blob,
    );
  }
  return blob.includes(token);
}

function hasBrandNameEvidence(
  candidate: LogoCandidate,
  ctx: LogoRankingContext,
): boolean {
  const alt = candidate.alt ?? "";
  const pathBlob = candidatePathBlob(candidate);
  const pathMatch = ctx.brandTokens.some((t) => brandTokenMatches(pathBlob, t));
  if (altLooksLikeMarketingPhotoCaption(alt)) {
    return pathMatch;
  }
  const blob = candidateBrandBlob(candidate);
  return ctx.brandTokens.some((t) => brandTokenMatches(blob, t));
}

function looksLikeMarketingOrCustomerImage(candidate: LogoCandidate): boolean {
  const blob = candidateTextBlob(candidate);
  if (MARKETING_OR_CUSTOMER_PATH_RE.test(blob)) return true;
  const alt = candidate.alt ?? "";
  if (candidate.source === "img-logo" && altLooksLikeMarketingPhotoCaption(alt)) {
    return true;
  }
  return false;
}

function looksLikeNavDecorNotLogo(candidate: LogoCandidate): boolean {
  const blob = candidateTextBlob(candidate);
  if (/flags\.svg|\/flags(?:\/|$)/i.test(blob)) return true;
  if (/nav-bg|nav_background|sessions-\d/i.test(blob)) return true;
  const alt = (candidate.alt ?? "").trim();
  if (alt.length >= 2 && alt.length <= 3 && /^[A-Z]{2,3}$/.test(alt)) return true;
  if (
    candidate.source === "header-image" &&
    /background|sessions/i.test(blob) &&
    !LOGOISH_PATH_RE.test(blob)
  ) {
    return true;
  }
  return false;
}

function looksLikePrimaryBrandMarkAsset(candidate: LogoCandidate): boolean {
  const pathBlob = candidatePathBlob(candidate);
  if (/favicon\.svg(?:$|\?)/i.test(pathBlob)) return true;
  if (isFaviconStyleLogoCandidate(candidate)) return false;
  if (/\.ico(?:$|\?)/i.test(pathBlob)) return false;
  if (PRIMARY_BRAND_MARK_PATH_RE.test(pathBlob)) return true;
  if (LOGOISH_PATH_RE.test(pathBlob) && !MARKETING_OR_CUSTOMER_PATH_RE.test(pathBlob)) {
    return true;
  }
  return false;
}

/** Whether an og:image is plausibly a logo mark vs. a generic share/hero image. */
export function ogImageLooksLogoLike(
  candidate: LogoCandidate,
  ctx: LogoRankingContext = { brandTokens: [] },
): boolean {
  if (candidate.source !== "og:image") return false;
  const alt = (candidate.alt ?? "").toLowerCase();
  if (alt.includes("logo")) return true;
  if (urlLooksLogoish(candidate.url)) return true;
  if (hasBrandNameEvidence(candidate, ctx)) return true;
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

const PRODUCT_ALT_LOGO_RE =
  /\b(google play|play store|app store|chrome|chromium|google docs|google sheets|google slides|google maps|youtube|gmail|android|gemini|drive|calendar|photos|wallet|assistant)\b/i;

function looksLikeProductAppIcon(candidate: LogoCandidate): boolean {
  const blob = candidateTextBlob(candidate);
  if (
    PRODUCT_APP_HINT_RE.test(blob) ||
    PRODUCT_ALT_LOGO_RE.test(blob) ||
    PRODUCT_PATH_RE.test(candidate.url)
  ) {
    return true;
  }
  const { width, height } = candidate;
  if (
    typeof width === "number" &&
    typeof height === "number" &&
    width >= 36 &&
    width <= 200 &&
    height >= 36 &&
    height <= 200
  ) {
    const ratio = width / height;
    const squareish = ratio >= 0.86 && ratio <= 1.14;
    const isFaviconFallback =
      candidate.source === "icon" || candidate.source === "apple-touch-icon";
    if (squareish && !isFaviconFallback) {
      if (
        PRODUCT_APP_HINT_RE.test(blob) ||
        /\/(images|static|assets)\/.*\/(icon|logo_|product)/i.test(candidate.url)
      ) {
        return true;
      }
    }
  }
  return false;
}

function looksLikeWordmarkDimensions(candidate: LogoCandidate): boolean {
  const { width, height } = candidate;
  if (typeof width !== "number" || typeof height !== "number") return false;
  if (width < 72 || height < 20 || height > 160) return false;
  const ratio = width / height;
  return ratio >= 1.6 && ratio <= 6.5;
}

function maxSidePx(candidate: LogoCandidate): number | undefined {
  const { width, height } = candidate;
  if (typeof width === "number" && typeof height === "number") {
    return Math.max(width, height);
  }
  if (typeof width === "number") return width;
  if (typeof height === "number") return height;
  return undefined;
}

function isFaviconSource(source: LogoCandidateSource): boolean {
  return source === "icon" || source === "apple-touch-icon";
}

function urlHintsSmallIcon(url: string): boolean {
  return /fav[_-]?icon|favicon|icon[_-]?\d|\/32x32|\/64x64|width=32\b|height=32\b|width=64\b|height=64\b/i.test(
    url,
  );
}

/** Very small square marks (16–64px) — poor for print layout vs. header wordmarks. */
function isVerySmallLogoIcon(candidate: LogoCandidate): boolean {
  const max = maxSidePx(candidate);
  if (max !== undefined && max <= 64) return true;
  if (isFaviconSource(candidate.source) && urlHintsSmallIcon(candidate.url)) {
    return true;
  }
  const { width, height } = candidate;
  if (
    typeof width === "number" &&
    typeof height === "number" &&
    width <= 64 &&
    height <= 64
  ) {
    return true;
  }
  return false;
}

function isSquareIcon(candidate: LogoCandidate): boolean {
  const { width, height } = candidate;
  if (typeof width !== "number" || typeof height !== "number") return false;
  const ratio = width / height;
  return ratio >= 0.88 && ratio <= 1.12;
}

/** Larger non-square artwork that may carry the brand mark outside header/nav. */
function looksLikeLargeLogoGraphic(candidate: LogoCandidate): boolean {
  const { width, height } = candidate;
  if (typeof width !== "number" || typeof height !== "number") return false;
  const max = Math.max(width, height);
  const min = Math.min(width, height);
  if (max < 96 || min < 28) return false;
  if (isSquareIcon(candidate) && max <= 128) return false;
  const ratio = width / height;
  return ratio >= 0.55 && ratio <= 4.5;
}

function baseScoreForSource(
  source: LogoCandidateSource,
  candidate: LogoCandidate,
  ctx: LogoRankingContext,
): { points: number; label: string } {
  switch (source) {
    case "header-image":
      return hasStrongWordmarkEvidence(candidate, ctx)
        ? { points: 94, label: "header/nav image" }
        : { points: 36, label: "header/nav image (weak logo evidence)" };
    case "img-logo":
      return {
        points: hasBrandNameEvidence(candidate, ctx) ? 78 : 68,
        label: hasBrandNameEvidence(candidate, ctx)
          ? "logo-tagged image (brand match)"
          : "logo-tagged image",
      };
    case "og:image":
      return ogImageLooksLogoLike(candidate, ctx)
        ? { points: 32, label: "og:image (logo-like)" }
        : { points: 6, label: "og:image (generic)" };
    case "apple-touch-icon":
      return { points: 22, label: "apple-touch-icon (fallback)" };
    case "icon":
      return { points: 8, label: "favicon/icon (fallback)" };
    default:
      return { points: 4, label: "image" };
  }
}

function inferTransparencyFromUrl(
  candidate: LogoCandidate,
): LogoCandidateTransparency {
  const ext = fileExtension(candidate.url);
  if (SVG_EXT_RE.test(candidate.url) || ext === "svg") {
    return "likely_transparent";
  }
  if (JPEG_EXT_RE.test(candidate.url) || ext === "jpg" || ext === "jpeg") {
    return "likely_opaque";
  }
  if (PNG_EXT_RE.test(candidate.url) || WEBP_EXT_RE.test(candidate.url)) {
    return "unknown";
  }
  return "unknown";
}

/**
 * Score for design placement. Brand/wordmark evidence is primary; transparency
 * is a small bonus applied later in {@link applyTransparencyBonus}.
 */
export function scoreLogoCandidate(
  candidate: LogoCandidate,
  ctx: LogoRankingContext = { brandTokens: [] },
): ScoredLogoCandidate {
  const logoRole = classifyLogoRole(candidate, ctx);
  const reasons: string[] = [];
  const { points: sourcePoints, label: sourceLabel } = baseScoreForSource(
    candidate.source,
    candidate,
    ctx,
  );
  let score = sourcePoints;
  reasons.push(sourceLabel);

  const alt = (candidate.alt ?? "").toLowerCase();

  const pathBlob = candidatePathBlob(candidate);
  const strongWordmark = hasStrongWordmarkEvidence(candidate, ctx);

  if (hasBrandNameEvidence(candidate, ctx)) {
    score += 42;
    reasons.push("brand name in alt/path");
  }
  if (altHasLogoKeyword(candidate.alt ?? "") && !altLooksLikeMarketingCopy(alt)) {
    score += 18;
    reasons.push("alt matches logo keyword");
  }
  if (/primary[_-]?logo/i.test(pathBlob)) {
    score += 40;
    reasons.push("primary logo asset path");
  }
  if (pathHasStrongLogoEvidence(pathBlob)) {
    score += 14;
    reasons.push("brand logo path");
  } else if (urlLooksLogoish(candidate.url)) {
    score += 6;
    reasons.push("logo-like path");
  }

  const ext = fileExtension(candidate.url);
  if (ext === "svg" || SVG_EXT_RE.test(candidate.url)) {
    score += 16;
    reasons.push("SVG wordmark/logo");
  } else if (ext === "png") {
    score += 6;
    reasons.push("PNG");
  } else if (ext === "webp") {
    score += 4;
    reasons.push("WebP");
  } else if (ext === "jpg" || ext === "jpeg") {
    score -= 12;
    reasons.push("JPEG (often photo)");
  }

  if (looksLikeWordmarkDimensions(candidate) && strongWordmark) {
    score += 18;
    reasons.push("wordmark proportions");
  } else if (
    looksLikeWordmarkDimensions(candidate) &&
    !strongWordmark
  ) {
    score -= 8;
    reasons.push("not enough logo evidence");
  }

  if (logoRole === "wordmark" && strongWordmark) {
    score += 20;
    reasons.push("classified wordmark");
  }

  if (logoRole === "marketing_image") {
    score -= 150;
    reasons.push("penalized: marketing image");
  }

  if (
    candidate.source === "header-image" &&
    strongWordmark
  ) {
    score += 10;
    reasons.push("header wordmark with brand match");
  }

  if (
    looksLikeLargeLogoGraphic(candidate) &&
    (urlLooksLogoish(candidate.url) || hasBrandNameEvidence(candidate, ctx))
  ) {
    score += 12;
    reasons.push("larger logo-like graphic");
  }

  const maxSide = maxSidePx(candidate);
  if (typeof maxSide === "number" && maxSide >= 120 && !isSquareIcon(candidate)) {
    score += 8;
    reasons.push("larger usable dimensions");
  }

  if (looksLikePrimaryBrandMarkAsset(candidate)) {
    score += 58;
    reasons.push("primary brand mark asset");
  }
  if (/favicon\.svg(?:$|\?)/i.test(candidatePathBlob(candidate))) {
    score += 14;
    reasons.push("SVG favicon brand mark");
  }

  if (/\.ico(?:$|\?)/i.test(candidatePathBlob(candidate))) {
    score -= 30;
    reasons.push("favicon .ico (weak for print)");
  }

  if (looksLikeFailoverLogoUrl(candidate)) {
    score -= 160;
    reasons.push("penalized: failover/HTML logo path");
  }

  if (
    looksLikeMarketingOrCustomerImage(candidate) ||
    candidateLooksLikeMarketingImage(candidate)
  ) {
    score -= 120;
    reasons.push("penalized: marketing/customer image");
  }

  if (looksLikeNavDecorNotLogo(candidate)) {
    score -= 85;
    reasons.push("penalized: nav/decor image");
  }

  if (
    candidate.source === "og:image" &&
    !urlLooksLogoish(candidate.url) &&
    !/\blogo\b/i.test(alt)
  ) {
    score -= 45;
    reasons.push("penalized: generic og:image share art");
  }

  if (looksLikeProductAppIcon(candidate)) {
    score -= 58;
    reasons.push("penalized: product/app icon");
  }

  const primaryBrandMark = looksLikePrimaryBrandMarkAsset(candidate);

  if (isFaviconSource(candidate.source) && !primaryBrandMark) {
    if (logoRole === "icon_mark") {
      score -= 10;
      reasons.push("compact icon mark");
    } else {
      score -= 36;
      reasons.push("favicon fallback");
    }
  }

  if (logoRole === "icon_mark" && (brandHitForScore(candidate, ctx) || primaryBrandMark)) {
    score += 22;
    reasons.push("brand icon mark");
  }

  if (isVerySmallLogoIcon(candidate) && !primaryBrandMark && logoRole !== "icon_mark") {
    score -= 48;
    reasons.push("small icon penalty");
  }

  if (
    isFaviconSource(candidate.source) &&
    isSquareIcon(candidate) &&
    !primaryBrandMark &&
    logoRole === "fallback_icon"
  ) {
    score -= 28;
    reasons.push("square favicon/app icon");
  }

  const { width, height } = candidate;
  if (typeof width === "number" && width > 640) {
    score -= 16;
    reasons.push("very wide");
  }
  if (typeof height === "number" && height > 420) {
    score -= 12;
    reasons.push("very tall");
  }

  const transparency = inferTransparencyFromUrl(candidate);

  return {
    ...candidate,
    logoRole,
    score: Math.round(score),
    transparency,
    reason: reasons.join("; "),
  };
}

function brandHitForScore(
  candidate: LogoCandidate,
  ctx: LogoRankingContext,
): boolean {
  return hasBrandNameEvidence(candidate, ctx);
}

/** Sort by score descending; stable tie-break keeps earlier discovery order. */
export function sortLogoCandidatesByScore(
  candidates: LogoCandidate[],
  ctx: LogoRankingContext = { brandTokens: [] },
): ScoredLogoCandidate[] {
  const scored = candidates.map((c, index) => ({
    ...scoreLogoCandidate(c, ctx),
    _order: index,
  }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a._order - b._order;
  });
  return scored.map((row) => {
    const { _order, ...rest } = row;
    void _order;
    return rest;
  });
}

/** Small secondary boost — must not outweigh brand/wordmark signals. */
export function applyTransparencyBonus(
  candidate: ScoredLogoCandidate,
): ScoredLogoCandidate {
  let score = candidate.score;
  const reasons = candidate.reason ? [candidate.reason] : [];
  const smallFavicon =
    isFaviconSource(candidate.source) && isVerySmallLogoIcon(candidate);

  if (candidate.transparency === "likely_transparent") {
    const bonus = smallFavicon ? 1 : 3;
    score += bonus;
    if (SVG_EXT_RE.test(candidate.url) && !smallFavicon) {
      reasons.push("likely transparent SVG");
    } else if (smallFavicon) {
      reasons.push("transparent favicon (minor bonus)");
    } else {
      reasons.push("likely transparent");
    }
  } else if (candidate.transparency === "likely_opaque") {
    score -= 3;
  }
  return {
    ...candidate,
    score: Math.round(score),
    reason: reasons.join("; "),
  };
}

export function resortScoredCandidates(
  candidates: ScoredLogoCandidate[],
): ScoredLogoCandidate[] {
  return [...candidates].sort((a, b) => b.score - a.score);
}

/** Strong enough for primary design review (wordmark / header / large brand logo). */
export function isStrongDesignLogoCandidate(
  candidate: LogoCandidate,
  ctx: LogoRankingContext = { brandTokens: [] },
): boolean {
  const scored =
    typeof candidate.score === "number"
      ? (candidate as ScoredLogoCandidate)
      : scoreLogoCandidate(candidate, ctx);

  if (scored.logoRole === "marketing_image") return false;
  if (scored.logoRole === "social_preview") return false;
  if (looksLikeProductAppIcon(scored)) return false;
  if (looksLikeMarketingOrCustomerImage(scored)) return false;
  if (candidateLooksLikeMarketingImage(scored)) return false;
  if (looksLikeNavDecorNotLogo(scored)) return false;
  if (looksLikePrimaryBrandMarkAsset(scored) && (scored.score ?? 0) >= 70) {
    return true;
  }
  if (
    scored.logoRole === "icon_mark" &&
    (scored.score ?? 0) >= 68 &&
    (hasBrandNameEvidence(scored, ctx) || looksLikePrimaryBrandMarkAsset(scored))
  ) {
    return true;
  }
  if (scored.score >= 120) return true;
  if (
    scored.source === "header-image" &&
    hasStrongWordmarkEvidence(scored, ctx)
  ) {
    return true;
  }
  if (
    scored.source === "img-logo" &&
    hasStrongWordmarkEvidence(scored, ctx) &&
    (looksLikeWordmarkDimensions(scored) || (scored.score ?? 0) >= 85)
  ) {
    return true;
  }
  if (
    looksLikeWordmarkDimensions(scored) &&
    hasStrongWordmarkEvidence(scored, ctx)
  ) {
    return true;
  }
  return false;
}

/** Weak rows to drop from the main grid when at least one strong candidate exists. */
function shouldHideWhenStrongCandidatesExist(
  candidate: ScoredLogoCandidate,
  ctx: LogoRankingContext,
  hasHeaderWordmark: boolean,
): boolean {
  if (isStrongDesignLogoCandidate(candidate, ctx)) return false;
  if (looksLikeProductAppIcon(candidate)) return true;
  if (looksLikeMarketingOrCustomerImage(candidate)) return true;
  if (looksLikeNavDecorNotLogo(candidate)) return true;
  if (candidate.logoRole === "social_preview") return true;
  if (candidate.logoRole === "marketing_image") return true;
  if (candidate.previewFetch?.accepted === false) return true;
  if (looksLikeFailoverLogoUrl(candidate)) return true;
  if (
    hasHeaderWordmark &&
    (candidate.logoRole === "fallback_icon" ||
      (isFaviconSource(candidate.source) &&
        candidate.logoRole !== "icon_mark" &&
        !looksLikePrimaryBrandMarkAsset(candidate)))
  ) {
    return true;
  }
  if (
    hasHeaderWordmark &&
    candidate.source === "og:image" &&
    candidate.logoRole !== "wordmark"
  ) {
    return true;
  }
  if (
    isFaviconSource(candidate.source) &&
    isVerySmallLogoIcon(candidate) &&
    candidate.logoRole !== "icon_mark"
  ) {
    return true;
  }
  if (
    isFaviconSource(candidate.source) &&
    candidate.score < 45 &&
    candidate.logoRole !== "icon_mark"
  ) {
    return true;
  }
  if (candidate.source === "og:image" && !ogImageLooksLogoLike(candidate, ctx)) {
    return true;
  }
  if (
    candidate.source === "og:image" &&
    ogImageLooksLogoLike(candidate, ctx) &&
    candidate.score < 55
  ) {
    return true;
  }
  if (candidate.source === "apple-touch-icon" && isVerySmallLogoIcon(candidate)) {
    return true;
  }
  if (candidate.score < 20) return true;
  return false;
}

/**
 * Final UI-facing list: ranked for design usefulness, favicons/product icons
 * hidden when a stronger header/wordmark exists; falls back to full sorted list
 * if filtering would leave nothing.
 */
export function filterLogoCandidatesForDesignUi(
  candidates: ScoredLogoCandidate[],
  ctx: LogoRankingContext = { brandTokens: [] },
  max = 6,
): ScoredLogoCandidate[] {
  const sorted = resortScoredCandidates(candidates);
  const strongList = sorted.filter((c) => isStrongDesignLogoCandidate(c, ctx));
  const hasStrong = strongList.length > 0;
  const hasHeaderWordmark = strongList.some(
    (c) =>
      c.logoRole === "wordmark" ||
      (c.logoRole === "icon_mark" && hasStrongWordmarkEvidence(c, ctx)),
  );

  let pool = sorted;
  if (hasStrong) {
    const filtered = sorted.filter(
      (c) => !shouldHideWhenStrongCandidatesExist(c, ctx, hasHeaderWordmark),
    );
    if (filtered.length > 0) pool = filtered;
  }

  return pool.slice(0, max);
}

/** Primary badge: only the top-ranked card (index 0). */
export function logoPrimaryDesignLabel(index: number): string | null {
  return index === 0 ? "Best match" : null;
}

/** Role badge for each card (wordmark, icon mark, etc.). */
export function logoRoleDesignLabel(candidate: LogoCandidate): string {
  return logoRoleUiLabel(candidate.logoRole ?? classifyLogoRole(candidate));
}

/** @deprecated Use logoPrimaryDesignLabel + logoRoleDesignLabel */
export function logoDesignLabel(
  candidate: LogoCandidate,
  index: number,
): string | null {
  const primary = logoPrimaryDesignLabel(index);
  if (primary) return primary;
  return logoRoleDesignLabel(candidate);
}

export function isFallbackIconCandidate(candidate: LogoCandidate): boolean {
  return (
    candidate.source === "icon" || candidate.source === "apple-touch-icon"
  );
}
