import sharp from "sharp";
import type { LogoCandidate } from "@/lib/analyzeWebsiteResponse";
import { normalizeHex } from "@/lib/evalLocal/brandExtractionParse";
import {
  refineLogoDerivedPalette,
  type WeightedLogoColor,
} from "@/lib/evalLocal/logoPaletteRefine";
import { fetchImageBytesSafe } from "@/lib/server/safeImageFetch";

export type LogoPaletteResult = {
  colors: string[];
  paletteSource: "logo";
  paletteConfidence: "medium";
  rawColorCount: number;
  distinctColorCount: number;
};

function hexFromRgb(r: number, g: number, b: number): string {
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export async function extractRawDominantColorsFromImageBuffer(
  buffer: Buffer,
  maxColors = 12,
): Promise<WeightedLogoColor[]> {
  const { data, info } = await sharp(buffer)
    .resize(64, 64, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buckets = new Map<
    string,
    { count: number; r: number; g: number; b: number }
  >();
  const channels = info.channels;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const a = channels >= 4 ? data[i + 3] ?? 255 : 255;
    if (a < 128) continue;

    const key = `${r >> 3},${g >> 3},${b >> 3}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  const ranked = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, maxColors * 2);

  const weighted: WeightedLogoColor[] = [];
  const seen = new Set<string>();

  for (const bucket of ranked) {
    const r = Math.round(bucket.r / bucket.count);
    const g = Math.round(bucket.g / bucket.count);
    const b = Math.round(bucket.b / bucket.count);
    const hex = hexFromRgb(r, g, b);
    if (seen.has(hex)) continue;
    seen.add(hex);
    weighted.push({ hex, weight: bucket.count });
    if (weighted.length >= maxColors) break;
  }

  return weighted;
}

/** Dominant colors from a logo image buffer, merged and capped for brand review. */
export async function extractDominantHexColorsFromImageBuffer(
  buffer: Buffer,
  maxColors = 4,
): Promise<string[]> {
  const raw = await extractRawDominantColorsFromImageBuffer(buffer);
  const refined = refineLogoDerivedPalette(raw, { maxCount: maxColors });
  return refined.colors;
}

function pickLogoCandidates(logos: LogoCandidate[]): LogoCandidate[] {
  const withUrl = logos.filter((l) => l.url?.trim());
  if (withUrl.length === 0) return [];

  const nonIcon = withUrl.filter(
    (l) => l.source !== "icon" && l.source !== "apple-touch-icon",
  );
  const pool = nonIcon.length > 0 ? nonIcon : withUrl;
  return pool.slice(0, 3);
}

export async function derivePaletteFromLogoCandidates(
  logos: LogoCandidate[],
): Promise<LogoPaletteResult | null> {
  for (const candidate of pickLogoCandidates(logos)) {
    const url = candidate.url?.trim();
    if (!url) continue;
    const bytes = await fetchImageBytesSafe(url);
    if (!bytes || bytes.length === 0) continue;

    try {
      const raw = await extractRawDominantColorsFromImageBuffer(bytes);
      const refined = refineLogoDerivedPalette(raw);
      const normalized = refined.colors
        .map((c) => normalizeHex(c))
        .filter((c): c is string => Boolean(c));
      if (normalized.length === 0) continue;
      return {
        colors: normalized,
        paletteSource: "logo",
        paletteConfidence: "medium",
        rawColorCount: refined.rawColorCount,
        distinctColorCount: refined.distinctColorCount,
      };
    } catch {
      continue;
    }
  }
  return null;
}
