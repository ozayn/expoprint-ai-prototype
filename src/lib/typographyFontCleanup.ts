import type { TypographySignals } from "@/lib/typographySignals";

/** Generic stack families worth keeping in signals (not named webfonts). */
const KEEP_STACK_FAMILIES: Record<string, string> = {
  "-apple-system": "-apple-system",
  "blinkmacsystemfont": "BlinkMacSystemFont",
  "system-ui": "system-ui",
  "ui-sans-serif": "ui-sans-serif",
  "ui-serif": "ui-serif",
  "ui-monospace": "ui-monospace",
  "sans-serif": "sans-serif",
  "serif": "serif",
  "monospace": "monospace",
  "cursive": "cursive",
  "fantasy": "fantasy",
};

const REJECT_CSS_KEYWORDS = new Set([
  "normal",
  "inherit",
  "initial",
  "unset",
  "revert",
  "revert-layer",
  "default",
  "auto",
  "none",
  "bold",
  "bolder",
  "lighter",
  "italic",
  "oblique",
  "small-caps",
  "all-small-caps",
  "inherit",
  "break-word",
  "pre",
  "wrap",
]);

const NUMERIC_ONLY_RE = /^-?\d+(\.\d+)?$/;
const FONT_WEIGHT_RE = /^[1-9]00$/;
const CSS_LENGTH_RE = /^-?\d+(\.\d+)?(px|rem|em|ex|ch|vw|vh|vmin|vmax|%|pt|pc|in|cm|mm)$/i;

/**
 * Returns a cleaned font-family token, or null if it is clearly not a family name.
 */
export function sanitizeFontFamilyToken(raw: string): string | null {
  const t = raw
    .replace(/!important/gi, "")
    .replace(/^['"]+|['"]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t.length > 48) return null;

  const lower = t.toLowerCase();

  if (REJECT_CSS_KEYWORDS.has(lower)) return null;
  if (NUMERIC_ONLY_RE.test(lower)) return null;
  if (FONT_WEIGHT_RE.test(lower)) return null;
  if (CSS_LENGTH_RE.test(lower)) return null;
  if (/^var\s*\(/i.test(t)) return null;
  if (/^[#.]/.test(t)) return null;
  if (/^\d/.test(t) && !/[a-z]/i.test(t)) return null;

  const stack = KEEP_STACK_FAMILIES[lower];
  if (stack) return stack;

  if (!/[a-z]/i.test(t)) return null;
  if (t.length < 2) return null;

  return t;
}

export function sanitizeFontFamilyList(families: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of families) {
    const name = sanitizeFontFamilyToken(raw);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** Deduplicated typography lists with non-font tokens removed. */
export function sanitizeTypographySignals(
  signals: TypographySignals,
): TypographySignals {
  const googleFontFamilies = sanitizeFontFamilyList(signals.googleFontFamilies);
  const headingFontCandidates = sanitizeFontFamilyList(
    signals.headingFontCandidates,
  );
  const bodyFontCandidates = sanitizeFontFamilyList(signals.bodyFontCandidates);
  const fontFamilies = sanitizeFontFamilyList([
    ...signals.fontFamilies,
    ...googleFontFamilies,
    ...headingFontCandidates,
    ...bodyFontCandidates,
  ]);

  return {
    fontFamilies,
    headingFontCandidates,
    bodyFontCandidates,
    googleFontFamilies,
    styleGuess: signals.styleGuess,
  };
}
