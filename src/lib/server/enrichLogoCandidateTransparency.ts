import type { LogoCandidateTransparency } from "@/lib/analyzeWebsiteResponse";
import {
  applyTransparencyBonus,
  resortScoredCandidates,
  type ScoredLogoCandidate,
} from "@/lib/logoCandidateRanking";

const ENRICH_TIMEOUT_MS = 2_500;
const MAX_SNIPPET_BYTES = 48_000;

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPngBuffer(buf: Uint8Array): boolean {
  if (buf.length < 26) return false;
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== PNG_SIG[i]) return false;
  }
  return true;
}

/** PNG color types 4 (grayscale+alpha) and 6 (RGBA) include transparency. */
function pngHasAlphaChannel(buf: Uint8Array): boolean | null {
  if (!isPngBuffer(buf)) return null;
  const colorType = buf[25];
  if (colorType === 4 || colorType === 6) return true;
  if (colorType === 0 || colorType === 2 || colorType === 3) return false;
  return null;
}

function analyzeSvgMarkup(svg: string): LogoCandidateTransparency {
  const sample = svg.slice(0, 24_000).toLowerCase();
  const fullRectBg =
    /<rect[^>]*\bwidth\s*=\s*["'](?:100%|[^"']*\d[^"']*)["'][^>]*\bheight\s*=\s*["'](?:100%|[^"']*\d[^"']*)["'][^>]*\bfill\s*=\s*["'](?:#fff(?:fff)?|white|rgb\(\s*255)/i.test(
      sample,
    ) ||
    /<rect[^>]*\bfill\s*=\s*["'](?:#fff(?:fff)?|white)["'][^>]*\bwidth\s*=\s*["']100%/i.test(
      sample,
    );
  if (fullRectBg) return "likely_opaque";
  if (/background(?:-color)?\s*:\s*(?:#fff(?:fff)?|white|rgb\(\s*255)/i.test(sample)) {
    return "likely_opaque";
  }
  return "likely_transparent";
}

async function readBodyCap(
  res: Response,
  maxBytes: number,
): Promise<Uint8Array | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.length) continue;
      if (total + value.length > maxBytes) {
        const take = maxBytes - total;
        if (take > 0) chunks.push(value.slice(0, take));
        total = maxBytes;
        break;
      }
      chunks.push(value);
      total += value.length;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

async function fetchSnippet(url: string): Promise<Uint8Array | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ENRICH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent":
          "ExpoPrintAI-Prototype/1.0 (+https://github.com/ozayn/expoprint-ai-prototype)",
      },
    });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (ct.includes("text/html")) return null;
    return await readBodyCap(res, MAX_SNIPPET_BYTES);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function needsByteInspection(c: ScoredLogoCandidate): boolean {
  const u = c.url.toLowerCase();
  if (u.includes(".svg")) return true;
  if (u.includes(".png")) return true;
  if (u.includes(".webp")) return true;
  return false;
}

async function enrichOne(candidate: ScoredLogoCandidate): Promise<ScoredLogoCandidate> {
  if (!needsByteInspection(candidate)) {
    return candidate;
  }

  const buf = await fetchSnippet(candidate.url);
  if (!buf?.length) {
    return candidate;
  }

  const urlLower = candidate.url.toLowerCase();
  let transparency = candidate.transparency;
  const extra: string[] = [];

  if (urlLower.includes(".svg") || (buf[0] === 0x3c && buf[1] === 0x73)) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    transparency = analyzeSvgMarkup(text);
    extra.push(
      transparency === "likely_opaque"
        ? "SVG with solid background"
        : "SVG likely transparent",
    );
  } else if (urlLower.includes(".png")) {
    const alpha = pngHasAlphaChannel(buf);
    if (alpha === true) {
      transparency = "likely_transparent";
      extra.push("PNG alpha channel");
    } else if (alpha === false) {
      transparency = "likely_opaque";
      extra.push("PNG without alpha");
    }
  }

  const reason = [candidate.reason, ...extra].filter(Boolean).join("; ");
  return applyTransparencyBonus({
    ...candidate,
    transparency,
    reason,
  });
}

/**
 * Optional bounded fetches for top candidates only — improves transparency hints
 * without blocking the whole analyze flow for long.
 */
export async function enrichLogoCandidatesTransparency(
  candidates: ScoredLogoCandidate[],
  maxEnrich = 6,
): Promise<ScoredLogoCandidate[]> {
  const toEnrich = candidates.slice(0, maxEnrich);
  const rest = candidates.slice(maxEnrich);
  const enriched = await Promise.all(toEnrich.map((c) => enrichOne(c)));
  return resortScoredCandidates([...enriched, ...rest]);
}
