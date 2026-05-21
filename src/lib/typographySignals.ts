import { sanitizeTypographySignals } from "@/lib/typographyFontCleanup";

/**
 * Typography signals extracted from website HTML/CSS (prototype).
 * Shared by server extraction, API metadata, and client intake state.
 */

export type TypographyStyleGuess =
  | "modern_sans"
  | "classic_serif"
  | "playful"
  | "technical"
  | "unknown";

export type TypographySignals = {
  fontFamilies: string[];
  headingFontCandidates: string[];
  bodyFontCandidates: string[];
  googleFontFamilies: string[];
  styleGuess: TypographyStyleGuess;
};

export const TYPOGRAPHY_STYLE_LABELS: Record<TypographyStyleGuess, string> = {
  modern_sans: "modern sans",
  classic_serif: "classic serif",
  playful: "playful",
  technical: "technical",
  unknown: "unknown",
};

export function emptyTypographySignals(): TypographySignals {
  return {
    fontFamilies: [],
    headingFontCandidates: [],
    bodyFontCandidates: [],
    googleFontFamilies: [],
    styleGuess: "unknown",
  };
}

/** Safe subset exposed on `websiteFetch` (no raw CSS). */
export type WebsiteTypographyMeta = {
  fontFamilies: string[];
  headingFontCandidates: string[];
  bodyFontCandidates: string[];
  googleFontFamilies: string[];
  styleGuess: TypographyStyleGuess;
  fontFamilyCount: number;
  googleFontCount: number;
};

/** Caps and count fields aligned with API `websiteFetch.typography` payloads. */
export function buildWebsiteTypographyMeta(
  clean: TypographySignals,
): WebsiteTypographyMeta | undefined {
  if (
    clean.fontFamilies.length === 0 &&
    clean.googleFontFamilies.length === 0
  ) {
    return undefined;
  }
  const fontFamilies = clean.fontFamilies.slice(0, 8);
  const headingFontCandidates = clean.headingFontCandidates.slice(0, 4);
  const bodyFontCandidates = clean.bodyFontCandidates.slice(0, 4);
  const googleFontFamilies = clean.googleFontFamilies.slice(0, 6);
  return {
    fontFamilies,
    headingFontCandidates,
    bodyFontCandidates,
    googleFontFamilies,
    styleGuess: clean.styleGuess,
    fontFamilyCount: fontFamilies.length,
    googleFontCount: googleFontFamilies.length,
  };
}

export function toWebsiteTypographyMeta(
  signals: TypographySignals,
): WebsiteTypographyMeta | undefined {
  return buildWebsiteTypographyMeta(sanitizeTypographySignals(signals));
}

/** Re-sync counts with returned font lists (defense when metadata is passed through). */
export function syncWebsiteTypographyMetaCounts(
  meta: WebsiteTypographyMeta,
): WebsiteTypographyMeta {
  return {
    ...meta,
    fontFamilyCount: meta.fontFamilies.length,
    googleFontCount: meta.googleFontFamilies.length,
  };
}
