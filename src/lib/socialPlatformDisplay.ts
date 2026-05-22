export type SocialPlatformId =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "x"
  | "youtube";

export type ParsedSocialLink = {
  platform: SocialPlatformId;
  /** Badge mark, e.g. `▶`, `f`, `in` */
  platformMark: string;
  /** Platform name without mark, e.g. `YouTube` */
  platformLabel: string;
  /** Short handle beside badge, e.g. `@shopify` or `/company/stripe` */
  labelText: string;
  /** Full footer token for width fitting, e.g. `◎ @shopify` */
  displayText: string;
  /** Raw path suffix from URL, e.g. `/shopify` or `/@shopify` */
  pathSuffix: string;
  /** Ranking score for brand-relevant profile selection (internal). */
  score?: number;
};

export type SocialLinkParseContext = {
  businessName?: string;
  websiteUrl?: string;
  /** Product category — tent/expo layouts use tighter handle display and lower caps. */
  productCategory?: string;
  surfaceLabel?: string | null;
};

const PLATFORM_LABELS: Record<SocialPlatformId, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
};

/** Compact platform marks rendered as Fabric text inside a small badge (export-safe). */
export const SOCIAL_PLATFORM_MARKS: Record<SocialPlatformId, string> = {
  youtube: "▶",
  instagram: "◎",
  facebook: "f",
  linkedin: "in",
  x: "X",
};

const HOST_PLATFORM: Array<{ re: RegExp; platform: SocialPlatformId }> = [
  { re: /(^|\.)instagram\.com$/i, platform: "instagram" },
  { re: /(^|\.)facebook\.com$|(^|\.)fb\.com$/i, platform: "facebook" },
  { re: /(^|\.)linkedin\.com$/i, platform: "linkedin" },
  { re: /(^|\.)twitter\.com$|(^|\.)x\.com$/i, platform: "x" },
  { re: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i, platform: "youtube" },
];

const PATH_SUFFIX_MAX = 36;
const HANDLE_DISPLAY_MAX = 28;
const DISPLAY_TEXT_MAX = 32;

const BRAND_TOKEN_STOP = new Set([
  "the",
  "and",
  "inc",
  "llc",
  "ltd",
  "corp",
  "co",
  "company",
  "official",
]);

const YOUTUBE_REJECT_PATH_RE =
  /^\/(watch|shorts|embed|playlist|live|feed|gaming|results|clip|redirect)(\/|$)/i;

const FACEBOOK_REJECT_PATH_RE =
  /^\/(share|sharer|sharer\.php|dialog|plugins|posts|videos|watch|photo\.php|story\.php|groups|events|marketplace|login|help|privacy|policies|legal|l\.php|flx|reel|reels)(\/|$)/i;

const INSTAGRAM_REJECT_PATH_RE =
  /^\/(p|reel|reels|stories|tv|explore|accounts|direct|about|legal|developer)(\/|$)/i;

const X_REJECT_PATH_RE =
  /^\/(intent|share|i|home|search|explore|settings|privacy|tos|hashtag|status)(\/|$)/i;

const LINKEDIN_REJECT_PATH_RE =
  /^\/(posts|feed|pulse|learning|jobs|login|signup|share|shareArticle|embed|video|events|groups|school|public-profile)(\/|$)/i;

const GENERIC_SOCIAL_PATH_RE =
  /^\/(watch|shorts|embed|playlist|share|sharer|intent|post|posts|video|videos|reel|reels)(\/|$)/i;

function detectPlatform(hostname: string): SocialPlatformId | null {
  const host = hostname.replace(/^www\./i, "").toLowerCase();
  for (const { re, platform } of HOST_PLATFORM) {
    if (re.test(host)) return platform;
  }
  return null;
}

function normalizePath(pathname: string): string {
  const path = pathname.replace(/\/+/g, "/").replace(/\/$/, "");
  return path || "/";
}

function brandTokensFromContext(ctx: SocialLinkParseContext): string[] {
  const tokens = new Set<string>();
  const addFromText = (raw: string) => {
    for (const word of raw.toLowerCase().split(/[^a-z0-9]+/)) {
      const w = word.trim();
      if (w.length < 3 || BRAND_TOKEN_STOP.has(w)) continue;
      tokens.add(w);
    }
  };
  if (ctx.businessName?.trim()) addFromText(ctx.businessName);
  if (ctx.websiteUrl?.trim()) {
    try {
      const host = new URL(
        /^https?:\/\//i.test(ctx.websiteUrl)
          ? ctx.websiteUrl
          : `https://${ctx.websiteUrl}`,
      ).hostname
        .replace(/^www\./i, "")
        .toLowerCase();
      const label = host.split(".")[0] ?? "";
      if (label.length >= 3 && !BRAND_TOKEN_STOP.has(label)) tokens.add(label);
    } catch {
      /* ignore */
    }
  }
  return [...tokens];
}

function slugMatchesBrand(slug: string, brandTokens: string[]): boolean {
  const s = slug.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!s) return false;
  return brandTokens.some((t) => {
    const token = t.replace(/[^a-z0-9]+/g, "");
    if (token.length < 3) return false;
    return s.includes(token) || token.includes(s);
  });
}

function firstPathSegment(path: string): string {
  const parts = path.replace(/^\//, "").split("/").filter(Boolean);
  return parts[0] ?? "";
}

function isYoutubeProfileUrl(url: URL, brandTokens: string[]): boolean {
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (/(^|\.)youtu\.be$/i.test(host)) return false;

  const path = normalizePath(url.pathname);
  if (YOUTUBE_REJECT_PATH_RE.test(path)) return false;
  if (path === "/watch" || url.searchParams.has("v")) return false;

  if (path.startsWith("/@")) return true;
  if (/^\/channel\//i.test(path)) return true;
  if (/^\/c\//i.test(path)) return true;
  if (/^\/user\//i.test(path)) return true;

  const slug = firstPathSegment(path);
  if (slug && !YOUTUBE_REJECT_PATH_RE.test(`/${slug}`)) {
    return brandTokens.length > 0 && slugMatchesBrand(slug, brandTokens);
  }

  return false;
}

function splitSocialRawTokens(raw: string): string[] {
  const chunks = raw
    .split(/\s*[,;·•|]\s*|[\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const chunk of chunks) {
    const embedded = chunk.match(/https?:\/\/[^\s,;·•|]+/gi);
    if (embedded && embedded.length > 1) {
      out.push(...embedded.map((u) => u.trim()));
      continue;
    }
    const spaced = chunk
      .split(/\s+(?=https?:\/\/)/i)
      .map((s) => s.trim())
      .filter(Boolean);
    if (spaced.length > 1) {
      out.push(...spaced);
      continue;
    }
    out.push(chunk);
  }
  return out;
}

function isDisplayableCanvasHandle(handleText: string): boolean {
  const h = handleText.trim();
  if (!h) return false;
  if (GENERIC_SOCIAL_PATH_RE.test(h)) return false;
  if (/^\/watch(?:\/|$)/i.test(h)) return false;
  return true;
}

function formatCanvasHandle(url: URL, platform: SocialPlatformId): string | null {
  const path = normalizePath(url.pathname);
  const parts = path.split("/").filter(Boolean);

  if (platform === "instagram") {
    const slug = parts[0];
    if (!slug) return null;
    const handle = slug.replace(/^@/, "");
    return handle ? `@${handle}` : null;
  }

  if (platform === "facebook") {
    if (/^pages$/i.test(parts[0] ?? "") && parts[1]) return `/${parts[1]}`;
    const slug = parts[0];
    return slug ? `/${slug}` : null;
  }

  if (platform === "x") {
    const slug = parts[0];
    return slug ? `/${slug}` : null;
  }

  if (platform === "linkedin") {
    if (/^company$/i.test(parts[0] ?? "") && parts[1]) {
      return `/company/${parts[1]}`;
    }
    if (/^in$/i.test(parts[0] ?? "") && parts[1]) {
      return `/in/${parts[1]}`;
    }
    if (/^school$/i.test(parts[0] ?? "") && parts[1]) {
      return `/school/${parts[1]}`;
    }
    return null;
  }

  if (platform === "youtube") {
    if (path.startsWith("/@")) {
      const handle = path.slice(2);
      return handle ? `@${handle}` : null;
    }
    if (/^channel$/i.test(parts[0] ?? "") && parts[1]) {
      return `/channel/${parts[1]}`;
    }
    if (/^user$/i.test(parts[0] ?? "") && parts[1]) {
      return `/user/${parts[1]}`;
    }
    if (/^c$/i.test(parts[0] ?? "") && parts[1]) {
      return `/c/${parts[1]}`;
    }
    const slug = parts[0];
    return slug ? `/${slug}` : null;
  }

  return null;
}

function formatSocialFooterStrings(
  platform: SocialPlatformId,
  handleText: string,
): { labelText: string; displayText: string } | null {
  const mark = SOCIAL_PLATFORM_MARKS[platform];
  const labelText = handleText.trim();
  if (!labelText || labelText.length > HANDLE_DISPLAY_MAX) return null;
  const displayText = `${mark} ${labelText}`;
  if (displayText.length > DISPLAY_TEXT_MAX) return null;
  return { labelText, displayText };
}

function isLinkedInProfileUrl(url: URL, brandTokens: string[]): boolean {
  const path = normalizePath(url.pathname);
  if (LINKEDIN_REJECT_PATH_RE.test(path)) return false;
  if (/^\/company\//i.test(path)) return true;
  if (/^\/school\//i.test(path)) return true;
  if (/^\/showcase\//i.test(path)) return true;

  const inMatch = /^\/in\/([^/]+)/i.exec(path);
  if (inMatch) {
    const handle = inMatch[1] ?? "";
    return brandTokens.length > 0 && slugMatchesBrand(handle, brandTokens);
  }

  return false;
}

function isFacebookProfileUrl(url: URL): boolean {
  const path = normalizePath(url.pathname);
  if (path === "/") return false;
  if (FACEBOOK_REJECT_PATH_RE.test(path)) return false;
  if (/^\/pages\//i.test(path)) return true;

  const slug = firstPathSegment(path);
  if (!slug) return false;
  if (/^(profile|people|pages|pg)$/i.test(slug)) return false;
  return path.split("/").filter(Boolean).length <= 2;
}

function isInstagramProfileUrl(url: URL): boolean {
  const path = normalizePath(url.pathname);
  if (path === "/") return false;
  if (INSTAGRAM_REJECT_PATH_RE.test(path)) return false;
  const slug = firstPathSegment(path);
  return Boolean(slug) && path.split("/").filter(Boolean).length === 1;
}

function isXProfileUrl(url: URL): boolean {
  const path = normalizePath(url.pathname);
  if (path === "/") return false;
  if (X_REJECT_PATH_RE.test(path)) return false;
  const slug = firstPathSegment(path);
  return Boolean(slug) && path.split("/").filter(Boolean).length === 1;
}

function isMeaningfulSocialProfileUrl(
  url: URL,
  platform: SocialPlatformId,
  brandTokens: string[],
): boolean {
  switch (platform) {
    case "youtube":
      return isYoutubeProfileUrl(url, brandTokens);
    case "linkedin":
      return isLinkedInProfileUrl(url, brandTokens);
    case "facebook":
      return isFacebookProfileUrl(url);
    case "instagram":
      return isInstagramProfileUrl(url);
    case "x":
      return isXProfileUrl(url);
    default:
      return false;
  }
}

function scoreSocialProfileUrl(
  url: URL,
  platform: SocialPlatformId,
  pathSuffix: string,
  brandTokens: string[],
): number {
  const path = normalizePath(url.pathname);
  let score = 10;

  const slug = firstPathSegment(pathSuffix.startsWith("/@") ? pathSuffix : path);
  const handle = slug.replace(/^@/, "");

  if (brandTokens.length > 0 && slugMatchesBrand(handle || slug, brandTokens)) {
    score += 80;
  }

  if (platform === "linkedin" && /^\/company\//i.test(path)) score += 50;
  if (platform === "youtube" && path.startsWith("/@")) score += 25;
  if (platform === "instagram" || platform === "facebook" || platform === "x") {
    if (path.split("/").filter(Boolean).length === 1) score += 20;
  }

  if (platform === "linkedin" && /^\/in\//i.test(path)) score -= 15;
  if (platform === "youtube" && /\/channel\//i.test(path)) score += 10;

  return score;
}

function pathSuffixFromUrl(
  url: URL,
  platform: SocialPlatformId,
  brandTokens: string[] = [],
): string | null {
  const path = normalizePath(url.pathname);

  if (platform === "youtube") {
    if (!isYoutubeProfileUrl(url, brandTokens)) return null;
    if (path.startsWith("/@")) {
      const handle = path.slice(1);
      return handle.length <= PATH_SUFFIX_MAX ? `/${handle}` : null;
    }
  }

  if (!path || path === "/") return "";

  let suffix = path;
  if (platform === "youtube" && suffix.startsWith("/@")) {
    suffix = suffix.slice(1);
  }

  if (suffix.length > PATH_SUFFIX_MAX) return null;
  return suffix.startsWith("/") ? suffix : `/${suffix}`;
}

/**
 * Parse one URL or host/path token into a compact badge + handle for canvas footer.
 * Returns null when the token is not a meaningful brand profile for canvas display.
 */
export function parseSocialLinkToken(
  rawToken: string,
  ctx: SocialLinkParseContext = {},
): ParsedSocialLink | null {
  let t = rawToken.trim();
  if (!t || t.length < 4) return null;
  t = t.replace(/^[\s.,;:·•|]+|[\s.,;:·•|]+$/g, "");
  if (!t) return null;

  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  const platform = detectPlatform(url.hostname);
  if (!platform) return null;

  const brandTokens = brandTokensFromContext(ctx);
  if (!isMeaningfulSocialProfileUrl(url, platform, brandTokens)) return null;

  const pathSuffix = pathSuffixFromUrl(url, platform, brandTokens);
  if (pathSuffix === null) return null;

  const handleText = formatCanvasHandle(url, platform);
  if (!handleText || !isDisplayableCanvasHandle(handleText)) return null;

  const formatted = formatSocialFooterStrings(platform, handleText);
  if (!formatted) return null;

  return {
    platform,
    platformMark: SOCIAL_PLATFORM_MARKS[platform],
    platformLabel: PLATFORM_LABELS[platform],
    pathSuffix,
    labelText: formatted.labelText,
    displayText: formatted.displayText,
    score: scoreSocialProfileUrl(url, platform, pathSuffix, brandTokens),
  };
}

/**
 * Canvas-only filter: parse raw intake/API social text into ranked brand profile
 * handles. Generic video/share URLs and non-brand personal profiles are dropped.
 */
export function filterSocialLinksForCanvasDisplay(
  raw: string,
  ctx: SocialLinkParseContext = {},
): ParsedSocialLink[] {
  return parseSocialLinksFromRaw(raw, ctx);
}

/** Split a selected social field into ranked, deduped profile entries. */
export function parseSocialLinksFromRaw(
  raw: string,
  ctx: SocialLinkParseContext = {},
): ParsedSocialLink[] {
  const tokens = splitSocialRawTokens(raw);

  const out: ParsedSocialLink[] = [];
  const seen = new Set<string>();

  for (const tok of tokens) {
    const parsed = parseSocialLinkToken(tok, ctx);
    if (!parsed) continue;
    const key = `${parsed.platform}:${parsed.pathSuffix.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed);
  }

  out.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return out;
}

/** True when at least one social token is displayable on the canvas footer. */
export function hasDisplayableSocialLinks(
  raw: string,
  ctx: SocialLinkParseContext = {},
): boolean {
  return filterSocialLinksForCanvasDisplay(raw, ctx).length > 0;
}

export function maxSocialItemsForSurface(
  category: string,
  surfaceLabel: string | null,
): number {
  if (category === "Outdoor tent") {
    if (surfaceLabel === "Canopy tent") return 1;
    return 2;
  }
  if (category === "Trade show booth") {
    return 2;
  }
  return 2;
}

function isTentOrExpoCategory(category: string): boolean {
  return category === "Outdoor tent" || category === "Trade show booth";
}

export function socialFooterTypography(
  category: string,
  surfaceLabel: string | null,
): { fontSize: number; iconSize: number; opacity: number } {
  if (category === "Outdoor tent" && surfaceLabel === "Canopy tent") {
    return { fontSize: 13, iconSize: 13, opacity: 0.88 };
  }
  if (isTentOrExpoCategory(category)) {
    return { fontSize: 14, iconSize: 14, opacity: 0.9 };
  }
  return { fontSize: 15, iconSize: 15, opacity: 0.95 };
}

export function estimateSocialItemWidthPx(
  displayText: string,
  fontSize: number,
  iconSize: number,
  gapPx = 6,
): number {
  return Math.ceil(iconSize + gapPx + displayText.length * fontSize * 0.52);
}

/**
 * Pick social links that fit in the footer band without truncating handles.
 * Prefers brand-matching official profiles; drops generic video/share URLs.
 */
export function pickSocialLinksForFooter(
  raw: string,
  maxItems: number,
  startLeftPx: number,
  maxRightPx: number,
  fontSize: number,
  iconSize: number,
  ctx: SocialLinkParseContext = {},
): ParsedSocialLink[] {
  const parsed = filterSocialLinksForCanvasDisplay(raw, ctx);
  const picked: ParsedSocialLink[] = [];
  let x = startLeftPx;

  for (const entry of parsed) {
    if (picked.length >= maxItems) break;
    const w = estimateSocialItemWidthPx(entry.displayText, fontSize, iconSize);
    if (x + w > maxRightPx) break;
    picked.push(entry);
    x += w + 12;
  }

  return picked;
}
