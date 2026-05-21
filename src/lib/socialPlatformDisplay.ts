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
  /** Text after the mark: platform + path, e.g. `YouTube /googleads` */
  labelText: string;
  /** Full footer token for width fitting, e.g. `▶ YouTube /googleads` */
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

function formatSocialFooterStrings(
  platform: SocialPlatformId,
  pathSuffix: string,
): { labelText: string; displayText: string } | null {
  const mark = SOCIAL_PLATFORM_MARKS[platform];
  const label = PLATFORM_LABELS[platform];
  const labelText = pathSuffix ? `${label} ${pathSuffix}` : label;
  const displayText = `${mark} ${labelText}`;
  if (displayText.length > DISPLAY_TEXT_MAX) return null;
  return { labelText, displayText };
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
  const formatted = formatSocialFooterStrings(platform, pathSuffix);
  if (!formatted) return null;

  return {
    platform,
    platformMark: SOCIAL_PLATFORM_MARKS[platform],
    platformLabel: PLATFORM_LABELS[platform],
    pathSuffix,
    labelText: formatted.labelText,
    displayText: formatted.displayText,
  };
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
