import type { StylePreference } from "@/lib/designIntakeState";
import { sanitizeTypographySignals } from "@/lib/typographyFontCleanup";
import {
  TYPOGRAPHY_STYLE_LABELS,
  type TypographySignals,
  type TypographyStyleGuess,
} from "@/lib/typographySignals";

/** Safe Fabric/browser stacks — no font file downloads. */
export const FABRIC_FONT_SYSTEM_SANS =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
export const FABRIC_FONT_GEOMETRIC_SANS =
  "'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
export const FABRIC_FONT_SERIF = "Georgia, 'Times New Roman', Times, serif";
export const FABRIC_FONT_TECHNICAL =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

export type FabricTypographyPlan = {
  headlineFontFamily: string;
  supportingFontFamily: string;
  uiFontFamily: string;
  styleGuess: TypographyStyleGuess;
  /** Primary detected names for UI (not necessarily installed). */
  detectedLabel: string;
};

function normalizeKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

type FontBucket = "system_sans" | "geometric_sans" | "serif" | "technical";

const FONT_BUCKET_RULES: { bucket: FontBucket; re: RegExp }[] = [
  {
    bucket: "technical",
    re: /\b(mono|courier|consolas|menlo|fira code|jetbrains|source code|ibm plex mono|roboto mono|inconsolata|space mono)\b/i,
  },
  {
    bucket: "serif",
    re: /\b(playfair|georgia|garamond|merriweather|lora|times|baskerville|caslon|dm serif|libre baskerville|noto serif|source serif)\b/i,
  },
  {
    bucket: "geometric_sans",
    re: /\b(montserrat|poppins|nunito|raleway|quicksand|rubik|outfit|manrope|urbanist)\b/i,
  },
  {
    bucket: "system_sans",
    re: /\b(inter|helvetica|arial|roboto|open sans|lato|segoe|sf pro|neue|frutiger|avenir|futura|gill sans|source sans|noto sans|ibm plex sans|work sans)\b/i,
  },
];

function bucketForFontName(name: string): FontBucket {
  const key = normalizeKey(name);
  for (const { bucket, re } of FONT_BUCKET_RULES) {
    if (re.test(key)) return bucket;
  }
  return "system_sans";
}

function stackForBucket(bucket: FontBucket): string {
  switch (bucket) {
    case "serif":
      return FABRIC_FONT_SERIF;
    case "geometric_sans":
      return FABRIC_FONT_GEOMETRIC_SANS;
    case "technical":
      return FABRIC_FONT_TECHNICAL;
    default:
      return FABRIC_FONT_SYSTEM_SANS;
  }
}

function pickPrimaryFontName(signals: TypographySignals): string | null {
  for (const n of [
    ...signals.headingFontCandidates,
    ...signals.googleFontFamilies,
    ...signals.bodyFontCandidates,
    ...signals.fontFamilies,
  ]) {
    if (normalizeKey(n)) return n;
  }
  return null;
}

function stackFromStyleGuess(
  guess: TypographyStyleGuess,
  stylePreference?: StylePreference,
): string {
  if (guess === "classic_serif") return FABRIC_FONT_SERIF;
  if (guess === "technical") return FABRIC_FONT_TECHNICAL;
  if (guess === "playful") return FABRIC_FONT_GEOMETRIC_SANS;
  if (stylePreference === "Traditional" || stylePreference === "Conservative") {
    return FABRIC_FONT_SERIF;
  }
  return FABRIC_FONT_SYSTEM_SANS;
}

/**
 * Map extracted typography signals to safe browser/Fabric font stacks.
 * Does not embed or load webfonts — uses fallbacks only.
 */
export function buildFabricTypographyFromSignals(
  signals: TypographySignals | null | undefined,
  stylePreference?: StylePreference,
): FabricTypographyPlan {
  const clean = signals ? sanitizeTypographySignals(signals) : null;
  if (!clean || clean.fontFamilies.length === 0) {
    const stack = stackFromStyleGuess("unknown", stylePreference);
    return {
      headlineFontFamily: stack,
      supportingFontFamily: stack,
      uiFontFamily: stack,
      styleGuess: "unknown",
      detectedLabel: "",
    };
  }

  const primary = pickPrimaryFontName(clean);
  const headlineName =
    clean.headingFontCandidates[0] ??
    clean.googleFontFamilies[0] ??
    primary;
  const bodyName =
    clean.bodyFontCandidates[0] ??
    clean.googleFontFamilies[0] ??
    primary;

  const headlineStack = headlineName
    ? stackForBucket(bucketForFontName(headlineName))
    : stackFromStyleGuess(clean.styleGuess, stylePreference);
  const bodyStack = bodyName
    ? stackForBucket(bucketForFontName(bodyName))
    : headlineStack;

  const detected = [
    ...clean.googleFontFamilies.slice(0, 2),
    ...clean.fontFamilies.slice(0, 3),
  ].filter((n, i, arr) => arr.findIndex((x) => normalizeKey(x) === normalizeKey(n)) === i);

  return {
    headlineFontFamily: headlineStack,
    supportingFontFamily: bodyStack,
    uiFontFamily: bodyStack,
    styleGuess: clean.styleGuess,
    detectedLabel: detected.slice(0, 4).join(", "),
  };
}

export function formatTypographySignalsLine(
  signals: TypographySignals | null | undefined,
): string {
  if (!signals) return "";
  const clean = sanitizeTypographySignals(signals);
  const names = [
    ...clean.googleFontFamilies,
    ...clean.fontFamilies,
  ].filter((n, i, arr) => arr.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i);
  if (names.length === 0) return "";
  const shown = names.slice(0, 3).join(", ");
  const style = TYPOGRAPHY_STYLE_LABELS[clean.styleGuess];
  return `Detected: ${shown}${names.length > 3 ? "…" : ""} · Style: ${style}`;
}
