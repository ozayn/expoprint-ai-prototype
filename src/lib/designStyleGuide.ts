/**
 * Internal prototype **design-guidance** layer for ExpoPrint intake → Fabric concepts.
 *
 * Role: act as a senior UX / brand-systems **starting point** for a B2B large-format print
 * assistant — calm and professional for ExpoPrint’s design team, **not** a literal website
 * color dump. This is **not** production ICC / spot / separations / ink limits; WCAG-style
 * checks are practical guardrails only, not audited print compliance.
 *
 * Design principles (heuristic implementation):
 * 1. **Minimal** — one accent shape; scale it down for loud palettes; clear typographic hierarchy.
 * 2. **Readable** — dark-on-light or light-on-dark; avoid red/blue, yellow/white, teal/blue clashes.
 * 3. **Brand discipline** — extracted hexes are *inputs*; ≤1–2 saturated hues read large; many
 *    brights → neutral field + small accents (e.g. consumer multi-primary sites).
 * 4. **Large-format** — paired with slightly larger type and extra column breathing room in
 *    `createDesignSpecFromIntake` when the accent is shrunk; avoid hairline UI strokes on the logo frame.
 * 5. **Style presets** — Modern / Conservative / Traditional / Playful tune accent opacity and
 *    polygon weight without breaking readability.
 */

import type { BrandColors } from "./designSpec";
import type { DesignIntakeState, StylePreference } from "./designIntakeState";

const FALLBACK: BrandColors = {
  navy: "#0B2E4A",
  teal: "#2BB3A3",
  white: "#FFFFFF",
};

const NEUTRAL_BG = "#f4f6f8";
const NEUTRAL_BG_COOL = "#f1f5f9";
const TEXT_HEADING_ON_LIGHT = "#0f172a";
const TEXT_BODY_ON_LIGHT = "#334155";
const TEXT_MUTED_ON_LIGHT = "#475569";
const TEXT_CONTACT_ON_LIGHT = "#64748b";

/** Semantic roles after normalization (see `normalizeBrandPalette`). */
export type NormalizedCanvasPalette = {
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  secondaryAccentColor: string;
  mutedTextColor: string;
};

export type ConceptColorPlan = NormalizedCanvasPalette & {
  /** Palette normalization mode (prototype debug). */
  paletteMode?: "multiBright" | "darkDominant" | "soft" | "greenBrandLight";
  /** Polygon fill (often a muted mix; not always identical to `accentColor`). */
  accentShape: string;
  accentOpacityFactor: number;
  /** < 1 shrinks the diagonal accent toward the origin for calmer layouts. */
  accentPolygonScale: number;
  headlineText: string;
  supportingText: string;
  websiteText: string;
  contactText: string;
  logoFill: string;
  logoStroke: string;
  logoLabelText: string;
  brandColors: BrandColors;
};

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

/** Parse #RGB / #RRGGBB from arbitrary extracted copy. */
export function parseHexColors(text: string): string[] {
  const re = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let h = m[0];
    if (h.length === 4) {
      const [, r, g, b] = h;
      h = `#${r}${r}${g}${g}${b}${b}`;
    }
    out.push(h.toLowerCase());
  }
  return out;
}

function hexToRgb(hex: string): Rgb | null {
  const t = hex.trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(t);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const u = Math.max(0, Math.min(1, t));
  return {
    r: a.r * (1 - u) + b.r * u,
    g: a.g * (1 - u) + b.g * u,
    b: a.b * (1 - u) + b.b * u,
  };
}

function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  if (!A) return b;
  if (!B) return a;
  return rgbToHex(mixRgb(A, B, t));
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) / 6;
    else if (max === G) h = ((B - R) / d + 2) / 6;
    else h = ((R - G) / d + 4) / 6;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h: h * 360, s, l };
}

function relativeLuminance(rgb: Rgb): number {
  const lin = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const r = lin(rgb.r);
  const g = lin(rgb.g);
  const b = lin(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG-style contrast ratio (1 = worst). Exported for tests / future UI. */
export function contrastRatio(fg: string, bg: string): number {
  const a = hexToRgb(fg);
  const b = hexToRgb(bg);
  if (!a || !b) return 1;
  const L1 = relativeLuminance(a);
  const L2 = relativeLuminance(b);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

function hslOf(hex: string): Hsl | null {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsl(rgb) : null;
}

function isReddish(h: Hsl): boolean {
  return (h.h <= 32 || h.h >= 328) && h.s > 0.22;
}

function isBlueish(h: Hsl): boolean {
  return h.h >= 200 && h.h <= 255 && h.s > 0.18;
}

function isYellowishBright(h: Hsl): boolean {
  return h.h >= 38 && h.h <= 68 && h.s > 0.35 && h.l > 0.55;
}

function isTealish(h: Hsl): boolean {
  return h.h >= 160 && h.h <= 200 && h.s > 0.2;
}

/**
 * Reduce “pretty but unreadable” pairings (red/blue war, yellow on white, teal on blue).
 * Complements luminance contrast — still a heuristic, not a full audit.
 */
export function avoidProblematicPairings(fg: string, bg: string): string {
  const f = hslOf(fg);
  const b = hslOf(bg);
  if (!f || !b) return fg;

  if (isReddish(f) && isBlueish(b)) {
    return mixHex(fg, relativeLuminance(hexToRgb(bg)!) > 0.45 ? "#1e293b" : "#f1f5f9", 0.72);
  }
  if (isBlueish(f) && isReddish(b)) {
    return mixHex(fg, "#f8fafc", 0.65);
  }
  if (isYellowishBright(f) && relativeLuminance(hexToRgb(bg)!) > 0.88) {
    return mixHex(fg, "#713f12", 0.55);
  }
  if (isTealish(f) && isBlueish(b) && contrastRatio(fg, bg) < 3.2) {
    return mixHex(fg, "#0f172a", 0.45);
  }
  return fg;
}

/** Push `fg` toward black or white until contrast vs `bg` reaches `min`. */
export function ensureReadableText(fg: string, bg: string, min: number): string {
  let cur = avoidProblematicPairings(fg, bg);
  for (let i = 0; i < 14; i++) {
    if (contrastRatio(cur, bg) >= min) return cur;
    const lumBg = relativeLuminance(hexToRgb(bg)!);
    cur =
      lumBg > 0.5
        ? mixHex(cur, "#0f172a", 0.22)
        : mixHex(cur, "#f8fafc", 0.22);
    cur = avoidProblematicPairings(cur, bg);
  }
  return relativeLuminance(hexToRgb(bg)!) > 0.55 ? "#0f172a" : "#f8fafc";
}

type Sample = { hex: string; rgb: Rgb; hsl: Hsl };

function analyzeSamples(hexes: string[]): Sample[] {
  const out: Sample[] = [];
  for (const hex of hexes) {
    const rgb = hexToRgb(hex);
    if (!rgb) continue;
    out.push({ hex, rgb, hsl: rgbToHsl(rgb) });
  }
  return out;
}

function isAchromaticNearBlack(s: Sample): boolean {
  return s.hsl.l <= 0.18 && s.hsl.s < 0.22;
}

/** Saturated brand greens (Shopify-like) — not teal UI chrome. */
function pickBrandGreen(samples: Sample[]): Sample | null {
  const greens = samples.filter(
    (s) =>
      s.hsl.h >= 115 &&
      s.hsl.h <= 168 &&
      s.hsl.s >= 0.28 &&
      s.hsl.l >= 0.22 &&
      s.hsl.l <= 0.58,
  );
  if (greens.length === 0) return null;
  return pickMostSaturated(greens);
}

function hasCleanLightNeutral(samples: Sample[]): boolean {
  return samples.some((s) => s.hsl.l >= 0.88 && s.hsl.s < 0.14);
}

function isStrongPrimary(s: Sample): boolean {
  return s.hsl.s >= 0.36 && s.hsl.l >= 0.22 && s.hsl.l <= 0.88;
}

function pickDarkest(samples: Sample[]): Sample | null {
  if (samples.length === 0) return null;
  return [...samples].sort((a, b) => a.hsl.l - b.hsl.l)[0]!;
}

function pickMostSaturated(samples: Sample[]): Sample | null {
  if (samples.length === 0) return null;
  return [...samples].sort((a, b) => b.hsl.s - a.hsl.s)[0]!;
}

function pickSecondSaturated(samples: Sample[], excludeHex: string): Sample | null {
  const rest = samples.filter((s) => s.hex !== excludeHex);
  if (rest.length === 0) return null;
  const sorted = [...rest].sort((a, b) => b.hsl.s - a.hsl.s);
  return sorted[1] ?? sorted[0]!;
}

function accentOpacityForStyle(style: StylePreference, mode: "multiBright" | "darkDominant" | "soft"): number {
  if (mode === "multiBright") {
    switch (style) {
      case "Conservative":
        return 0.22;
      case "Traditional":
        return 0.17;
      case "Playful":
        return 0.48;
      case "Modern":
      default:
        return 0.32;
    }
  }
  if (mode === "darkDominant") {
    switch (style) {
      case "Conservative":
        return 0.3;
      case "Traditional":
        return 0.52;
      case "Playful":
        return 0.85;
      case "Modern":
      default:
        return 0.52;
    }
  }
  switch (style) {
    case "Conservative":
      return 0.32;
    case "Traditional":
      return 0.55;
    case "Playful":
      return 0.88;
    case "Modern":
    default:
      return 0.74;
  }
}

function wrapPlan(
  base: NormalizedCanvasPalette & {
    accentShape: string;
    accentOpacityFactor: number;
    accentPolygonScale: number;
    logoFill: string;
    logoStroke: string;
    logoLabelText: string;
    brandColors: BrandColors;
  },
): ConceptColorPlan {
  const bg = base.backgroundColor;
  return {
    ...base,
    headlineText: ensureReadableText(base.textColor, bg, 3.2),
    supportingText: ensureReadableText(base.secondaryAccentColor, bg, 3),
    websiteText: ensureReadableText(base.mutedTextColor, bg, 3),
    contactText: ensureReadableText(base.mutedTextColor, bg, 3),
    accentShape: base.accentShape,
    accentOpacityFactor: base.accentOpacityFactor,
    accentPolygonScale: base.accentPolygonScale,
    logoFill: base.logoFill,
    logoStroke: base.logoStroke,
    logoLabelText: ensureReadableText(base.logoLabelText, base.logoFill, 2.8),
    brandColors: base.brandColors,
  };
}

function fallbackPlan(note?: string): ConceptColorPlan {
  const brandColors: BrandColors = {
    ...FALLBACK,
    ...(note ? { paletteNote: note } : {}),
  };
  const palette: NormalizedCanvasPalette = {
    backgroundColor: FALLBACK.navy,
    textColor: FALLBACK.white,
    accentColor: FALLBACK.teal,
    secondaryAccentColor: FALLBACK.teal,
    mutedTextColor: FALLBACK.white,
  };
  return wrapPlan({
    ...palette,
    accentShape: FALLBACK.teal,
    accentOpacityFactor: 1,
    accentPolygonScale: 1,
    logoFill: FALLBACK.white,
    logoStroke: FALLBACK.teal,
    logoLabelText: FALLBACK.navy,
    brandColors,
  });
}

/**
 * Map parsed brand hexes + style preset to semantic canvas roles (still prototype heuristics).
 */
export function normalizeBrandPalette(
  hexes: string[],
  style: StylePreference,
): NormalizedCanvasPalette & {
  mode: "multiBright" | "darkDominant" | "soft" | "greenBrandLight";
  accentPickHex: string;
} {
  const samples = analyzeSamples(hexes);
  if (samples.length === 0) {
    return {
      backgroundColor: FALLBACK.navy,
      textColor: FALLBACK.white,
      accentColor: FALLBACK.teal,
      secondaryAccentColor: FALLBACK.teal,
      mutedTextColor: mixHex(FALLBACK.white, FALLBACK.navy, 0.12),
      mode: "soft",
      accentPickHex: FALLBACK.teal,
    };
  }

  const strong = samples.filter(isStrongPrimary);
  const multiBright =
    strong.length >= 2 ||
    (samples.length >= 3 && strong.length >= 1 && samples.filter((s) => s.hsl.s > 0.28).length >= 3);

  const darkest = pickDarkest(samples);
  const brandGreen = pickBrandGreen(samples);
  const darkDominant =
    !multiBright &&
    darkest !== null &&
    darkest.hsl.l <= 0.22 &&
    samples.some((s) => s.hex !== darkest.hex && s.hsl.s > 0.18);

  /** Black + brand green → light field + green accent (avoid muddy black canvas). */
  if (
    darkDominant &&
    darkest !== null &&
    isAchromaticNearBlack(darkest) &&
    brandGreen !== null
  ) {
    const bg = hasCleanLightNeutral(samples) ? "#ffffff" : NEUTRAL_BG_COOL;
    return {
      backgroundColor: bg,
      textColor: TEXT_HEADING_ON_LIGHT,
      accentColor: brandGreen.hex,
      secondaryAccentColor: mixHex(brandGreen.hex, TEXT_BODY_ON_LIGHT, 0.62),
      mutedTextColor: TEXT_CONTACT_ON_LIGHT,
      mode: "greenBrandLight",
      accentPickHex: brandGreen.hex,
    };
  }

  if (multiBright) {
    const bg = style === "Traditional" ? "#fafaf9" : NEUTRAL_BG_COOL;
    const accentPick = pickMostSaturated(strong.length ? strong : samples)!;
    const second = pickSecondSaturated(samples, accentPick.hex);
    const secondary = second
      ? mixHex(second.hex, TEXT_BODY_ON_LIGHT, 0.62)
      : mixHex(accentPick.hex, TEXT_BODY_ON_LIGHT, 0.72);
    return {
      backgroundColor: bg,
      textColor: TEXT_HEADING_ON_LIGHT,
      accentColor: accentPick.hex,
      secondaryAccentColor: secondary,
      mutedTextColor: TEXT_CONTACT_ON_LIGHT,
      mode: "multiBright",
      accentPickHex: accentPick.hex,
    };
  }

  if (darkDominant && darkest) {
    const accentCandidate =
      pickMostSaturated(samples.filter((s) => s.hex !== darkest.hex)) ??
      pickMostSaturated(samples) ??
      darkest;
    let accent = accentCandidate.hex;
    if (contrastRatio(accent, darkest.hex) < 1.6) {
      accent = mixHex(accent, "#f8fafc", 0.35);
    }
    const second = pickSecondSaturated(samples, darkest.hex);
    const secondary = second
      ? ensureReadableText(mixHex(second.hex, "#e2e8f0", 0.35), darkest.hex, 3)
      : ensureReadableText(mixHex(accent, "#e2e8f0", 0.35), darkest.hex, 3);
    return {
      backgroundColor: darkest.hex,
      textColor: mixHex("#f8fafc", "#ffffff", 0.12),
      accentColor: accent,
      secondaryAccentColor: secondary,
      mutedTextColor: mixHex("#f8fafc", "#e2e8f0", 0.25),
      mode: "darkDominant",
      accentPickHex: accent,
    };
  }

  const sortedByLum = [...samples].sort((a, b) => a.hsl.l - b.hsl.l);
  const bgCandidate = sortedByLum[0]!;
  let bg =
    bgCandidate.hsl.l < 0.48 &&
    bgCandidate.hsl.s < 0.45 &&
    !isAchromaticNearBlack(bgCandidate)
      ? mixHex(bgCandidate.hex, "#0f172a", 0.35)
      : mixHex(NEUTRAL_BG, bgCandidate.hex, 0.08);
  if (relativeLuminance(hexToRgb(bg)!) > 0.55) {
    bg = NEUTRAL_BG;
  }
  const accentSource = pickMostSaturated(samples) ?? samples[0]!;
  const accent = accentSource.hex;
  const second = pickSecondSaturated(samples, accent);
  const secondary = second
    ? mixHex(second.hex, TEXT_BODY_ON_LIGHT, 0.55)
    : mixHex(accent, TEXT_BODY_ON_LIGHT, 0.58);

  if (relativeLuminance(hexToRgb(bg)!) < 0.35) {
    return {
      backgroundColor: bg,
      textColor: mixHex("#f8fafc", "#ffffff", 0.1),
      accentColor: accent,
      secondaryAccentColor: ensureReadableText(mixHex(accent, "#f1f5f9", 0.42), bg, 3),
      mutedTextColor: mixHex("#f8fafc", "#e2e8f0", 0.22),
      mode: "soft",
      accentPickHex: accent,
    };
  }

  return {
    backgroundColor: bg,
    textColor: TEXT_HEADING_ON_LIGHT,
    accentColor: accent,
    secondaryAccentColor: secondary,
    mutedTextColor: TEXT_MUTED_ON_LIGHT,
    mode: "soft",
    accentPickHex: accent,
  };
}

/**
 * Full plan for `createDesignSpecFromIntake`: semantic palette + layer-specific tints + geometry hints.
 */
export function buildConceptColorPlan(intake: DesignIntakeState): ConceptColorPlan {
  const row = intake.extracted.brandColors;
  const raw = row.useForDesign ? row.value.trim() : "";
  const hexes = raw ? parseHexColors(raw) : [];
  const note = raw || undefined;

  if (hexes.length === 0) {
    return { ...fallbackPlan(note), paletteMode: "soft" };
  }

  const norm = normalizeBrandPalette(hexes, intake.style);
  const { mode, accentPickHex } = norm;

  const brandColors: BrandColors = {
    navy: norm.backgroundColor,
    teal: norm.accentColor,
    white: norm.backgroundColor === FALLBACK.navy ? FALLBACK.white : "#ffffff",
    ...(note ? { paletteNote: note } : {}),
  };

  if (mode === "multiBright") {
    const accentMuted = mixHex(accentPickHex, "#cbd5e1", 0.58);
    const accentShape = mixHex(accentMuted, "#e8edf3", 0.35);
    const logoFill = "#ffffff";
    const logoStroke = mixHex(accentPickHex, "#94a3b8", 0.65);
    const logoLabel = mixHex(TEXT_HEADING_ON_LIGHT, "#64748b", 0.38);
    brandColors.white = logoFill;

    return {
      ...wrapPlan({
        backgroundColor: norm.backgroundColor,
        textColor: norm.textColor,
        accentColor: norm.accentColor,
        secondaryAccentColor: norm.secondaryAccentColor,
        mutedTextColor: norm.mutedTextColor,
        accentShape,
        accentOpacityFactor: accentOpacityForStyle(intake.style, "multiBright"),
        accentPolygonScale: 0.56,
        logoFill,
        logoStroke,
        logoLabelText: logoLabel,
        brandColors,
      }),
      paletteMode: mode,
    };
  }

  if (mode === "greenBrandLight") {
    const accentMuted = mixHex(accentPickHex, "#cbd5e1", 0.52);
    const accentShape = mixHex(accentMuted, "#e8edf3", 0.28);
    const logoFill = "#ffffff";
    const logoStroke = mixHex(accentPickHex, "#64748b", 0.55);
    const logoLabel = mixHex(TEXT_HEADING_ON_LIGHT, "#64748b", 0.35);
    brandColors.white = logoFill;
    brandColors.teal = norm.accentColor;
    brandColors.navy = norm.backgroundColor;

    return {
      ...wrapPlan({
        backgroundColor: norm.backgroundColor,
        textColor: norm.textColor,
        accentColor: norm.accentColor,
        secondaryAccentColor: norm.secondaryAccentColor,
        mutedTextColor: norm.mutedTextColor,
        accentShape,
        accentOpacityFactor: accentOpacityForStyle(intake.style, "soft"),
        accentPolygonScale: 0.72,
        logoFill,
        logoStroke,
        logoLabelText: logoLabel,
        brandColors,
      }),
      paletteMode: mode,
    };
  }

  if (mode === "darkDominant") {
    const bg = norm.backgroundColor;
    const accent = norm.accentColor;
    const logoFill = mixHex("#ffffff", bg, 0.12);
    const logoStroke = mixHex(accent, "#ffffff", 0.38);
    const logoLabel = mixHex(norm.textColor, bg, 0.28);
    brandColors.white = logoFill;

    return {
      ...wrapPlan({
        backgroundColor: bg,
        textColor: norm.textColor,
        accentColor: accent,
        secondaryAccentColor: norm.secondaryAccentColor,
        mutedTextColor: norm.mutedTextColor,
        accentShape: mixHex(accent, "#000000", 0.06),
        accentOpacityFactor: accentOpacityForStyle(intake.style, "darkDominant"),
        accentPolygonScale: 0.92,
        logoFill,
        logoStroke,
        logoLabelText: logoLabel,
        brandColors,
      }),
      paletteMode: mode,
    };
  }

  const bg = norm.backgroundColor;
  const accent = norm.accentColor;
  if (relativeLuminance(hexToRgb(bg)!) < 0.35) {
    brandColors.white = mixHex("#ffffff", bg, 0.08);
    return {
      ...wrapPlan({
        backgroundColor: bg,
        textColor: norm.textColor,
        accentColor: accent,
        secondaryAccentColor: norm.secondaryAccentColor,
        mutedTextColor: norm.mutedTextColor,
        accentShape: mixHex(accent, "#000000", 0.08),
        accentOpacityFactor: accentOpacityForStyle(intake.style, "soft"),
        accentPolygonScale: 0.88,
        logoFill: brandColors.white,
        logoStroke: mixHex(accent, "#ffffff", 0.28),
        logoLabelText: mixHex(norm.textColor, bg, 0.32),
        brandColors,
      }),
      paletteMode: mode,
    };
  }

  brandColors.white = "#ffffff";
  return {
    ...wrapPlan({
      backgroundColor: bg,
      textColor: norm.textColor,
      accentColor: accent,
      secondaryAccentColor: norm.secondaryAccentColor,
      mutedTextColor: norm.mutedTextColor,
      accentShape: mixHex(accent, "#e2e8f0", 0.38),
      accentOpacityFactor: accentOpacityForStyle(intake.style, "soft"),
      accentPolygonScale: 0.82,
      logoFill: "#ffffff",
      logoStroke: mixHex(accent, "#94a3b8", 0.48),
      logoLabelText: mixHex(TEXT_HEADING_ON_LIGHT, "#94a3b8", 0.38),
      brandColors,
    }),
    paletteMode: mode,
  };
}
