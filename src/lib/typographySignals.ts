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

export function toWebsiteTypographyMeta(
  signals: TypographySignals,
): WebsiteTypographyMeta | undefined {
  const clean = sanitizeTypographySignals(signals);
  if (
    clean.fontFamilies.length === 0 &&
    clean.googleFontFamilies.length === 0
  ) {
    return undefined;
  }
  return {
    fontFamilies: clean.fontFamilies.slice(0, 8),
    headingFontCandidates: clean.headingFontCandidates.slice(0, 4),
    bodyFontCandidates: clean.bodyFontCandidates.slice(0, 4),
    googleFontFamilies: clean.googleFontFamilies.slice(0, 6),
    styleGuess: clean.styleGuess,
    fontFamilyCount: clean.fontFamilies.length,
    googleFontCount: clean.googleFontFamilies.length,
  };
}
