import { normalizeHex } from "./brandExtractionParse";

export type WeightedLogoColor = {
  hex: string;
  weight: number;
};

export type LogoPaletteRefineResult = {
  colors: string[];
  rawColorCount: number;
  distinctColorCount: number;
};

export type LogoPaletteRefineOptions = {
  targetCount?: number;
  maxCount?: number;
  /** CIE76 ΔE threshold for merging similar colors (default 12). */
  deltaEThreshold?: number;
};

type Rgb = { r: number; g: number; b: number };
type Lab = { l: number; a: number; b: number };

const DEFAULT_TARGET = 3;
const DEFAULT_MAX = 4;
const DEFAULT_DELTA_E = 12;

function parseRgb(hex: string): Rgb | null {
  const n = normalizeHex(hex);
  if (!n || n.length !== 7) return null;
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  };
}

function hexFromRgb(rgb: Rgb): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function rgbToLab(rgb: Rgb): Lab {
  const linear = [rgb.r, rgb.g, rgb.b].map((c) => {
    const v = c / 255;
    return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
  });
  const x = (linear[0]! * 0.4124 + linear[1]! * 0.3576 + linear[2]! * 0.1805) / 0.95047;
  const y = (linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722) / 1.0;
  const z = (linear[0]! * 0.0193 + linear[1]! * 0.1192 + linear[2]! * 0.9505) / 1.08883;

  const f = (t: number) =>
    t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116;

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function deltaE76(a: Lab, b: Lab): number {
  const dl = a.l - b.l;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dl * dl + da * da + db * db);
}

function rgbToHsl(rgb: Rgb): { l: number; s: number } {
  const rn = rgb.r / 255;
  const gn = rgb.g / 255;
  const bn = rgb.b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { l, s: 0 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  return { l, s };
}

export type NeutralKind = "dark" | "light" | "gray";

export function classifyNeutral(rgb: Rgb): NeutralKind | null {
  const { l, s } = rgbToHsl(rgb);
  if (l < 0.08) return "dark";
  if (l > 0.92 && s < 0.12) return "light";
  if (s < 0.15 && l > 0.12 && l < 0.88) return "gray";
  return null;
}

type ColorCluster = {
  hex: string;
  rgb: Rgb;
  lab: Lab;
  weight: number;
  neutral: NeutralKind | null;
};

function normalizeWeightedInput(raw: WeightedLogoColor[]): ColorCluster[] {
  const merged = new Map<string, ColorCluster>();

  for (const entry of raw) {
    const rgb = parseRgb(entry.hex);
    if (!rgb) continue;
    const hex = hexFromRgb(rgb);
    const weight = entry.weight > 0 ? entry.weight : 1;
    const existing = merged.get(hex);
    if (existing) {
      existing.weight += weight;
      continue;
    }
    merged.set(hex, {
      hex,
      rgb,
      lab: rgbToLab(rgb),
      weight,
      neutral: classifyNeutral(rgb),
    });
  }

  return [...merged.values()];
}

function mergePerceptuallySimilar(
  clusters: ColorCluster[],
  deltaEThreshold: number,
): ColorCluster[] {
  const sorted = [...clusters].sort((a, b) => b.weight - a.weight);
  const used = new Set<string>();
  const merged: ColorCluster[] = [];

  for (const seed of sorted) {
    if (used.has(seed.hex)) continue;

    const group: ColorCluster[] = [seed];
    used.add(seed.hex);

    for (const other of sorted) {
      if (used.has(other.hex)) continue;
      if (deltaE76(seed.lab, other.lab) <= deltaEThreshold) {
        group.push(other);
        used.add(other.hex);
      }
    }

    const weight = group.reduce((sum, c) => sum + c.weight, 0);
    const dominant = group.reduce((best, c) =>
      c.weight > best.weight ? c : best,
    );

    merged.push({
      hex: dominant.hex,
      rgb: dominant.rgb,
      lab: dominant.lab,
      weight,
      neutral: dominant.neutral,
    });
  }

  return merged.sort((a, b) => b.weight - a.weight);
}

function selectFinalPalette(
  clusters: ColorCluster[],
  targetCount: number,
  maxCount: number,
): string[] {
  const accents = clusters.filter((c) => !c.neutral);
  const darkNeutrals = clusters.filter((c) => c.neutral === "dark");
  const lightNeutrals = clusters.filter((c) => c.neutral === "light");
  const grays = clusters.filter((c) => c.neutral === "gray");

  const pickBestNeutral = (list: ColorCluster[]): ColorCluster | null => {
    if (list.length === 0) return null;
    return list.reduce((best, c) => (c.weight > best.weight ? c : best));
  };

  const out: ColorCluster[] = [];

  for (const accent of accents) {
    if (out.length >= targetCount) break;
    out.push(accent);
  }

  const dark = pickBestNeutral(darkNeutrals);
  const light = pickBestNeutral(lightNeutrals);
  const gray = pickBestNeutral(grays);

  if (out.length < maxCount && dark && !out.some((c) => c.hex === dark.hex)) {
    out.push(dark);
  }
  if (out.length < maxCount && light && !out.some((c) => c.hex === light.hex)) {
    out.push(light);
  }
  if (
    out.length < maxCount &&
    gray &&
    !out.some((c) => c.hex === gray.hex) &&
    accents.length === 0
  ) {
    out.push(gray);
  }

  if (out.length === 0 && clusters.length > 0) {
    out.push(clusters[0]!);
  }

  return out.slice(0, maxCount).map((c) => c.hex);
}

/**
 * Collapse near-duplicate logo-derived colors and keep a small brand-useful palette.
 */
export function refineLogoDerivedPalette(
  raw: WeightedLogoColor[],
  options?: LogoPaletteRefineOptions,
): LogoPaletteRefineResult {
  const targetCount = options?.targetCount ?? DEFAULT_TARGET;
  const maxCount = options?.maxCount ?? DEFAULT_MAX;
  const deltaEThreshold = options?.deltaEThreshold ?? DEFAULT_DELTA_E;

  const normalized = normalizeWeightedInput(raw);
  const rawColorCount = normalized.length;
  if (rawColorCount === 0) {
    return { colors: [], rawColorCount: 0, distinctColorCount: 0 };
  }

  const merged = mergePerceptuallySimilar(normalized, deltaEThreshold);
  const distinctColorCount = merged.length;
  const colors = selectFinalPalette(merged, targetCount, maxCount);

  return {
    colors,
    rawColorCount,
    distinctColorCount,
  };
}

/** Refine a plain hex list (weights = dominance order). */
export function refineLogoPaletteHexes(
  hexes: string[],
  options?: LogoPaletteRefineOptions,
): LogoPaletteRefineResult {
  const weighted = hexes
    .map((hex, index) => {
      const rgb = parseRgb(hex);
      if (!rgb) return null;
      return {
        hex: hexFromRgb(rgb),
        weight: hexes.length - index,
      };
    })
    .filter((v): v is WeightedLogoColor => Boolean(v));

  return refineLogoDerivedPalette(weighted, options);
}
