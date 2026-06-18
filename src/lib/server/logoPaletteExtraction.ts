import sharp from "sharp";
import type { LogoCandidate } from "@/lib/analyzeWebsiteResponse";
import { normalizeHex } from "@/lib/evalLocal/brandExtractionParse";
import { fetchImageBytesSafe } from "@/lib/server/safeImageFetch";

export type LogoPaletteResult = {
  colors: string[];
  paletteSource: "logo";
  paletteConfidence: "medium";
};

function hexFromRgb(r: number, g: number, b: number): string {
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): { l: number; s: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { l, s: 0 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  return { l, s };
}

function isNearWhite(r: number, g: number, b: number): boolean {
  const { l, s } = rgbToHsl(r, g, b);
  return l > 0.92 && s < 0.12;
}

function isNearBlack(r: number, g: number, b: number): boolean {
  const { l } = rgbToHsl(r, g, b);
  return l < 0.08;
}

function filterExtremeNeutrals(hexes: string[]): string[] {
  if (hexes.length <= 1) return hexes;
  const rgbList = hexes
    .map((hex) => {
      const n = normalizeHex(hex);
      if (!n || n.length !== 7) return null;
      return {
        hex: n,
        r: parseInt(n.slice(1, 3), 16),
        g: parseInt(n.slice(3, 5), 16),
        b: parseInt(n.slice(5, 7), 16),
      };
    })
    .filter(
      (v): v is { hex: string; r: number; g: number; b: number } => Boolean(v),
    );

  const accentLike = rgbList.filter(
    (c) => !isNearWhite(c.r, c.g, c.b) && !isNearBlack(c.r, c.g, c.b),
  );
  if (accentLike.length === 0) return hexes;
  const keptNeutrals = rgbList.filter(
    (c) =>
      (isNearWhite(c.r, c.g, c.b) || isNearBlack(c.r, c.g, c.b)) &&
      accentLike.length >= 2,
  );
  const merged = [...accentLike, ...keptNeutrals.slice(0, 1)];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of merged) {
    if (seen.has(item.hex)) continue;
    seen.add(item.hex);
    out.push(item.hex);
  }
  return out.length > 0 ? out : hexes;
}

export async function extractDominantHexColorsFromImageBuffer(
  buffer: Buffer,
  maxColors = 6,
): Promise<string[]> {
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

  const hexes: string[] = [];
  for (const bucket of ranked) {
    const r = Math.round(bucket.r / bucket.count);
    const g = Math.round(bucket.g / bucket.count);
    const b = Math.round(bucket.b / bucket.count);
    const hex = hexFromRgb(r, g, b);
    if (!hexes.includes(hex)) hexes.push(hex);
    if (hexes.length >= maxColors) break;
  }

  return filterExtremeNeutrals(hexes).slice(0, maxColors);
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
      const colors = await extractDominantHexColorsFromImageBuffer(bytes);
      const normalized = colors
        .map((c) => normalizeHex(c))
        .filter((c): c is string => Boolean(c));
      if (normalized.length === 0) continue;
      return {
        colors: normalized,
        paletteSource: "logo",
        paletteConfidence: "medium",
      };
    } catch {
      continue;
    }
  }
  return null;
}
