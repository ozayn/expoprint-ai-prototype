import { load } from "cheerio";
import { sanitizeFontFamilyToken, sanitizeTypographySignals } from "@/lib/typographyFontCleanup";
import {
  emptyTypographySignals,
  type TypographySignals,
  type TypographyStyleGuess,
} from "@/lib/typographySignals";

const MAX_STYLE_BLOCK_CHARS = 48_000;
const MAX_CSS_FETCH_BYTES = 32_000;
const MAX_CSS_FETCH_MS = 3_000;
const MAX_SAME_ORIGIN_STYLESHEETS = 2;
const MAX_FAMILIES = 14;
const MAX_HEADING = 6;
const MAX_BODY = 6;
const MAX_GOOGLE = 8;

const SERIF_HINTS =
  /\b(playfair|georgia|garamond|merriweather|lora|times|baskerville|caslon|dm serif|libre baskerville|noto serif|source serif)\b/i;
const SANS_HINTS =
  /\b(inter|helvetica|arial|roboto|open sans|lato|segoe|sf pro|system|neue|frutiger|avenir|futura|gill sans|source sans|noto sans|ibm plex sans|work sans)\b/i;
const GEOMETRIC_HINTS = /\b(montserrat|poppins|nunito|raleway|quicksand|rubik|outfit|manrope|urbanist)\b/i;
const PLAYFUL_HINTS =
  /\b(comic|pacifico|lobster|fredoka|baloo|chewy|bubblegum|marker|handwriting|caveat|amatic)\b/i;
const TECH_HINTS =
  /\b(mono|courier|consolas|menlo|fira code|jetbrains|source code|ibm plex mono|roboto mono|inconsolata|space mono)\b/i;

const CLASS_FONT_RE =
  /\bfont[-_](inter|roboto|montserrat|poppins|playfair|lato|open-sans|raleway|nunito|merriweather|georgia|helvetica|arial)\b/i;

function parseFontFamilyList(value: string): string[] {
  const out: string[] = [];
  for (const part of value.split(",")) {
    const name = sanitizeFontFamilyToken(part);
    if (name) out.push(name);
  }
  return out;
}

/** CSS custom properties that hold font-family stacks — not weight/size/style. */
const FONT_FAMILY_VAR_RE =
  /--(?:font-family|font-heading|font-body|heading-font|body-font|font-sans|font-serif|typeface|typography)(?:-[a-z0-9]+)?\s*:\s*([^;}{]+)/gi;

function pushUnique(target: string[], names: string[], max: number) {
  for (const n of names) {
    if (target.length >= max) return;
    const key = n.toLowerCase();
    if (!target.some((x) => x.toLowerCase() === key)) {
      target.push(n);
    }
  }
}

function extractFontFamiliesFromCssText(css: string, into: string[]) {
  const capped = css.slice(0, MAX_STYLE_BLOCK_CHARS);
  const familyRe = /font-family\s*:\s*([^;}{]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = familyRe.exec(capped)) !== null) {
    pushUnique(into, parseFontFamilyList(m[1] ?? ""), MAX_FAMILIES);
  }
  let vm: RegExpExecArray | null;
  while ((vm = FONT_FAMILY_VAR_RE.exec(capped)) !== null) {
    const val = (vm[1] ?? "").trim();
    pushUnique(into, parseFontFamilyList(val), MAX_FAMILIES);
  }
}

function parseGoogleFontsHref(href: string, into: string[]) {
  try {
    const u = new URL(href);
    if (!/fonts\.googleapis\.com/i.test(u.hostname)) return;
    const familyParam = u.searchParams.get("family") ?? u.searchParams.get("text");
    if (!familyParam) return;
    for (const chunk of familyParam.split("|")) {
      const namePart = chunk.split(":")[0]?.replace(/\+/g, " ").trim();
      const name = namePart ? sanitizeFontFamilyToken(namePart) : null;
      if (name) pushUnique(into, [name], MAX_GOOGLE);
    }
  } catch {
    /* ignore */
  }
}

function classifyStyleGuess(families: string[]): TypographyStyleGuess {
  const blob = families.join(" ").toLowerCase();
  if (!blob.trim()) return "unknown";
  if (PLAYFUL_HINTS.test(blob)) return "playful";
  if (TECH_HINTS.test(blob)) return "technical";
  const serifScore = (blob.match(SERIF_HINTS) ?? []).length;
  const sansScore =
    (blob.match(SANS_HINTS) ?? []).length + (blob.match(GEOMETRIC_HINTS) ?? []).length;
  if (serifScore > sansScore && serifScore > 0) return "classic_serif";
  if (sansScore > 0 || GEOMETRIC_HINTS.test(blob)) return "modern_sans";
  return "unknown";
}

function isSameOriginStylesheet(href: string, baseUrl: string): string | null {
  try {
    const abs = new URL(href.trim(), baseUrl);
    if (abs.protocol !== "http:" && abs.protocol !== "https:") return null;
    const base = new URL(baseUrl);
    if (abs.hostname !== base.hostname) return null;
    if (BINARY_OR_CSS_SKIP_RE.test(abs.pathname)) return null;
    return abs.href;
  } catch {
    return null;
  }
}

const BINARY_OR_CSS_SKIP_RE =
  /\.(pdf|zip|png|jpe?g|gif|webp|svg|ico|mp4|woff2?|ttf|eot)(\?|$)/i;

async function fetchSameOriginCssSnippet(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAX_CSS_FETCH_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/css,*/*;q=0.8",
        "User-Agent":
          "ExpoPrintAI-Prototype/1.0 (+https://github.com/ozayn/expoprint-ai-prototype)",
      },
    });
    if (!res.ok) return "";
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (ct && !/text\/css/i.test(ct) && !ct.includes("text/plain")) {
      return "";
    }
    const cl = res.headers.get("content-length");
    if (cl) {
      const n = Number(cl);
      if (Number.isFinite(n) && n > MAX_CSS_FETCH_BYTES) return "";
    }
    if (!res.body) return "";
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.length) continue;
      if (total + value.length > MAX_CSS_FETCH_BYTES) {
        const take = MAX_CSS_FETCH_BYTES - total;
        if (take > 0) chunks.push(value.slice(0, take));
        break;
      }
      chunks.push(value);
      total += value.length;
    }
    const buf = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      buf.set(c, offset);
      offset += c.length;
    }
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    if (/@import/i.test(text)) {
      return text.replace(/@import[\s\S]*?;/gi, "");
    }
    return text;
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse typography from HTML only (sync). Does not fetch external stylesheets.
 */
export function extractTypographyFromHtml(html: string): TypographySignals {
  const $ = load(html);
  const fontFamilies: string[] = [];
  const headingFontCandidates: string[] = [];
  const bodyFontCandidates: string[] = [];
  const googleFontFamilies: string[] = [];

  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    parseGoogleFontsHref($(el).attr("href") ?? "", googleFontFamilies);
  });

  $("style").each((_, el) => {
    extractFontFamiliesFromCssText($(el).html() ?? "", fontFamilies);
  });

  $("[style]").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    const m = /font-family\s*:\s*([^;]+)/i.exec(style);
    if (m) {
      const names = parseFontFamilyList(m[1] ?? "");
      const tag = (el as { tagName?: string }).tagName?.toLowerCase() ?? "";
      if (/^h[1-6]$/.test(tag)) {
        pushUnique(headingFontCandidates, names, MAX_HEADING);
      } else if (tag === "body" || tag === "p") {
        pushUnique(bodyFontCandidates, names, MAX_BODY);
      }
      pushUnique(fontFamilies, names, MAX_FAMILIES);
    }
  });

  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    const m = /font-family\s*:\s*([^;]+)/i.exec(style);
    if (m) pushUnique(headingFontCandidates, parseFontFamilyList(m[1] ?? ""), MAX_HEADING);
    const cls = $(el).attr("class") ?? "";
    const cm = CLASS_FONT_RE.exec(cls);
    if (cm?.[1]) {
      const name = sanitizeFontFamilyToken(cm[1].replace(/-/g, " "));
      if (name) pushUnique(headingFontCandidates, [name], MAX_HEADING);
    }
  });

  $("body, p, main").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    const m = /font-family\s*:\s*([^;]+)/i.exec(style);
    if (m) pushUnique(bodyFontCandidates, parseFontFamilyList(m[1] ?? ""), MAX_BODY);
  });

  pushUnique(fontFamilies, googleFontFamilies, MAX_FAMILIES);
  pushUnique(fontFamilies, headingFontCandidates, MAX_FAMILIES);
  pushUnique(fontFamilies, bodyFontCandidates, MAX_FAMILIES);

  const styleGuess = classifyStyleGuess([
    ...googleFontFamilies,
    ...fontFamilies,
  ]);

  return sanitizeTypographySignals({
    fontFamilies: fontFamilies.slice(0, MAX_FAMILIES),
    headingFontCandidates: headingFontCandidates.slice(0, MAX_HEADING),
    bodyFontCandidates: bodyFontCandidates.slice(0, MAX_BODY),
    googleFontFamilies: googleFontFamilies.slice(0, MAX_GOOGLE),
    styleGuess,
  });
}

/**
 * Optionally enrich with same-origin stylesheet fetches (strict limits, no @import recursion).
 */
export async function enrichTypographyWithSameOriginCss(
  html: string,
  baseUrl: string,
  partial: TypographySignals,
): Promise<TypographySignals> {
  const $ = load(html);
  const fontFamilies = [...partial.fontFamilies];
  const urls: string[] = [];
  $('link[rel="stylesheet"][href]').each((_, el) => {
    const abs = isSameOriginStylesheet($(el).attr("href") ?? "", baseUrl);
    if (abs && !urls.includes(abs)) urls.push(abs);
  });

  for (const url of urls.slice(0, MAX_SAME_ORIGIN_STYLESHEETS)) {
    const css = await fetchSameOriginCssSnippet(url);
    if (css) extractFontFamiliesFromCssText(css, fontFamilies);
  }

  return sanitizeTypographySignals({
    ...partial,
    fontFamilies: fontFamilies.slice(0, MAX_FAMILIES),
    styleGuess: classifyStyleGuess([
      ...partial.googleFontFamilies,
      ...fontFamilies,
    ]),
  });
}

export function mergeTypographyAcrossPages(
  pages: { typography: TypographySignals }[],
): TypographySignals {
  if (pages.length === 0) return emptyTypographySignals();
  const fontFamilies: string[] = [];
  const headingFontCandidates: string[] = [];
  const bodyFontCandidates: string[] = [];
  const googleFontFamilies: string[] = [];

  for (const p of pages) {
    pushUnique(googleFontFamilies, p.typography.googleFontFamilies, MAX_GOOGLE);
    pushUnique(headingFontCandidates, p.typography.headingFontCandidates, MAX_HEADING);
    pushUnique(bodyFontCandidates, p.typography.bodyFontCandidates, MAX_BODY);
    pushUnique(fontFamilies, p.typography.fontFamilies, MAX_FAMILIES);
  }

  const homepage = pages[0]?.typography;
  if (homepage) {
    pushUnique(headingFontCandidates, homepage.headingFontCandidates, MAX_HEADING);
    pushUnique(bodyFontCandidates, homepage.bodyFontCandidates, MAX_BODY);
  }

  return sanitizeTypographySignals({
    fontFamilies,
    headingFontCandidates,
    bodyFontCandidates,
    googleFontFamilies,
    styleGuess: classifyStyleGuess([...googleFontFamilies, ...fontFamilies]),
  });
}
