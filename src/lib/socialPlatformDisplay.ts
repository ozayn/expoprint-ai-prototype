export type SocialPlatformId =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "x"
  | "youtube";

export type ParsedSocialLink = {
  platform: SocialPlatformId;
  /** e.g. `YouTube /googleads` */
  displayText: string;
  /** Path/handle suffix only, e.g. `/googleads` */
  pathSuffix: string;
};

const PLATFORM_LABELS: Record<SocialPlatformId, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
};

/** 24×24 viewBox paths — rendered via Fabric `Path` (no remote assets). */
export const SOCIAL_ICON_PATHS: Record<SocialPlatformId, string> = {
  youtube:
    "M 6 6 H 18 A 2 2 0 0 1 20 8 V 16 A 2 2 0 0 1 18 18 H 6 A 2 2 0 0 1 4 16 V 8 A 2 2 0 0 1 6 6 Z M 10 9 L 16 12 L 10 15 Z",
  x: "M 7 7 L 17 17 M 17 7 L 7 17",
  facebook:
    "M 13 7 H 11 A 2 2 0 0 0 9 9 V 11 H 7 V 15 H 9 V 19 H 13 V 15 H 15 V 11 H 13 Z",
  linkedin:
    "M 6 8 H 10 V 18 H 6 Z M 8 6 A 2 2 0 1 0 8 10 A 2 2 0 1 0 8 6 Z M 12 8 H 16 V 18 H 12 V 13 A 2 2 0 0 1 16 11 V 8",
  instagram:
    "M 7 7 H 17 A 2 2 0 0 1 19 9 V 15 A 2 2 0 0 1 17 17 H 7 A 2 2 0 0 1 5 15 V 9 A 2 2 0 0 1 7 7 Z M 12 10 A 2 2 0 1 0 12 14 A 2 2 0 1 0 12 10 Z M 16.2 8 H 16.25",
};

const HOST_PLATFORM: Array<{ re: RegExp; platform: SocialPlatformId }> = [
  { re: /(^|\.)instagram\.com$/i, platform: "instagram" },
  { re: /(^|\.)facebook\.com$|(^|\.)fb\.com$/i, platform: "facebook" },
  { re: /(^|\.)linkedin\.com$/i, platform: "linkedin" },
  { re: /(^|\.)twitter\.com$|(^|\.)x\.com$/i, platform: "x" },
  { re: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i, platform: "youtube" },
];

const PATH_SUFFIX_MAX = 36;
const DISPLAY_TEXT_MAX = 48;

function detectPlatform(hostname: string): SocialPlatformId | null {
  const host = hostname.replace(/^www\./i, "").toLowerCase();
  for (const { re, platform } of HOST_PLATFORM) {
    if (re.test(host)) return platform;
  }
  return null;
}

function pathSuffixFromUrl(url: URL, platform: SocialPlatformId): string {
  let path = url.pathname.replace(/\/+/g, "/").replace(/\/$/, "");
  if (!path || path === "/") {
    if (platform === "youtube" && url.searchParams.has("v")) {
      return "/watch";
    }
    return "";
  }

  if (platform === "youtube" && path.startsWith("/@")) {
    path = path.slice(1);
  }

  if (path.length > PATH_SUFFIX_MAX) return "";

  return path.startsWith("/") ? path : `/${path}`;
}

function formatDisplayText(
  platform: SocialPlatformId,
  pathSuffix: string,
): string {
  const label = PLATFORM_LABELS[platform];
  const text = pathSuffix ? `${label} ${pathSuffix}` : label;
  if (text.length > DISPLAY_TEXT_MAX) return "";
  return text;
}

/**
 * Parse one URL or host/path token into a platform label + short path suffix.
 * Returns null when the token cannot be shown whole (no mid-string truncation).
 */
export function parseSocialLinkToken(rawToken: string): ParsedSocialLink | null {
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

  const pathSuffix = pathSuffixFromUrl(url, platform);
  const displayText = formatDisplayText(platform, pathSuffix);
  if (!displayText) return null;

  return { platform, displayText, pathSuffix };
}

/** Split a selected social field into deduped platform entries (order preserved). */
export function parseSocialLinksFromRaw(raw: string): ParsedSocialLink[] {
  const tokens = raw
    .split(/\s*[,;·•|]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: ParsedSocialLink[] = [];
  const seen = new Set<string>();

  for (const tok of tokens) {
    const parsed = parseSocialLinkToken(tok);
    if (!parsed) continue;
    const key = parsed.displayText.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed);
  }

  return out;
}

export function maxSocialItemsForSurface(
  category: string,
  surfaceLabel: string | null,
): number {
  if (category === "Outdoor tent") {
    if (surfaceLabel === "Canopy tent") return 1;
    return 2;
  }
  return 3;
}

export function socialFooterTypography(
  category: string,
  surfaceLabel: string | null,
): { fontSize: number; iconSize: number; opacity: number } {
  if (category === "Outdoor tent" && surfaceLabel === "Canopy tent") {
    return { fontSize: 13, iconSize: 13, opacity: 0.88 };
  }
  if (category === "Outdoor tent") {
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
 */
export function pickSocialLinksForFooter(
  raw: string,
  maxItems: number,
  startLeftPx: number,
  maxRightPx: number,
  fontSize: number,
  iconSize: number,
): ParsedSocialLink[] {
  const parsed = parseSocialLinksFromRaw(raw);
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
