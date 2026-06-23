/**
 * Bounded multi-page website scrape (homepage + up to 3 same-origin links).
 * Invoked only from `runClaudeWebsiteAnalyze` in `claudeWebsiteAnalyze.ts` — not a separate API path.
 */
import { load } from "cheerio";
import type {
  LogoCandidate,
  LogoCandidateSource,
  WebsiteFetchMeta,
} from "@/lib/analyzeWebsiteResponse";
import { prepareLogoCandidatesForUi } from "@/lib/server/prepareLogoCandidatesForUi";
import {
  buildLogoRankingContext,
  scoreLogoCandidate,
  type LogoRankingContext,
} from "@/lib/logoCandidateRanking";
import {
  emptyTypographySignals,
  toWebsiteTypographyMeta,
  type TypographySignals,
} from "@/lib/typographySignals";
import {
  enrichTypographyWithSameOriginCss,
  extractTypographyFromHtml,
  mergeTypographyAcrossPages,
} from "@/lib/server/extractTypographySignals";
import { normalizeEmail, normalizePhoneDisplay } from "@/lib/contactFieldNormalize";
import { isStaticFetchBlocked } from "@/lib/websiteFetchBlocked";
import { filterBrandProfileSocialUrls } from "@/lib/socialPlatformDisplay";
import {
  extractStructuredContactFromHtml,
  mergeStructuredContacts,
  type ScrapedStructuredContact,
} from "@/lib/server/scrapeContactSignals";

/** Per GET (homepage or one extra page); avoids one short global timeout for multi-fetch. */
const PER_PAGE_FETCH_MS = 12_000;
const MAX_HTML_BYTES = 800_000;
/** Visible text cap when parsing a single document (before global budget trim). */
const MAX_VISIBLE_PARSE_HOMEPAGE = 14_000;
const MAX_VISIBLE_PARSE_EXTRA = 8_000;
/** Budget for visible excerpts passed to Claude across all pages. */
const TOTAL_VISIBLE_CONTEXT_CHARS = 18_000;
const HOMEPAGE_VISIBLE_BUDGET = 8_000;
const EXTRA_PAGE_VISIBLE_BUDGET = 4_000;
const MAX_EXTRA_PAGES = 3;
const MAX_LOGO_CANDIDATES_MERGED = 16;
/** Cap returned to the client UI for the small review grid. */
const MAX_LOGO_CANDIDATES_FOR_UI = 6;
const MAX_MAILTO_MERGED = 16;
const MAX_TEL_MERGED = 16;
const MAX_SOCIAL_MERGED = 20;

const SCRAPE_USER_AGENT =
  "ExpoPrintAI-Prototype/1.0 (+https://github.com/ozayn/expoprint-ai-prototype)";

const SOCIAL_HOST_RE =
  /(instagram\.com|facebook\.com|fb\.com|linkedin\.com|twitter\.com|x\.com|youtube\.com)/i;

const HIGH_PRIORITY_KEYWORDS = [
  "about",
  "services",
  "products",
  "solutions",
  "contact",
  "work",
  "portfolio",
  "menu",
  "locations",
] as const;

const BINARY_OR_ASSET_PATH_RE =
  /\.(pdf|zip|png|jpe?g|gif|webp|svg|ico|mp4|mp3|woff2?|ttf|eot)(\?|$)/i;

export type ScrapedPageSummary = {
  url: string;
  /** Heuristic bucket for this URL, e.g. `about`, `services`, `contact`. */
  pageType?: string;
  title: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  /** Flat list of absolute image URLs (for Claude prompt context, dedup). */
  logoCandidateUrls: string[];
  /** Structured candidates with source label and optional width/height/alt. */
  logoCandidatesDetailed: LogoCandidate[];
  mailtoHrefs: string[];
  telHrefs: string[];
  socialHrefs: string[];
  /** Raw parse cap; formatter applies global budget. */
  visibleTextSample: string;
  typography: TypographySignals;
  /** JSON-LD / structured contact signals (deduped per page). */
  structuredEmails: string[];
  structuredPhones: string[];
  structuredAddresses: string[];
  /** Footer / contentinfo text sample when present. */
  footerTextSample: string;
  /** Social hrefs before brand-profile filter. */
  socialHrefsDiscovered: string[];
};

export type WebsiteContentExtraction = {
  meta: WebsiteFetchMeta;
  /** Primary document after redirects. */
  homepage: ScrapedPageSummary;
  /** Up to three additional same-origin pages (empty if none or all failed). */
  additionalPages: ScrapedPageSummary[];
  /**
   * Mirrors homepage fields for callers that expect a flat shape (legacy).
   * Same as `homepage` fields.
   */
  title: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  logoCandidateUrls: string[];
  logoCandidatesDetailed: LogoCandidate[];
  mailtoHrefs: string[];
  telHrefs: string[];
  socialHrefs: string[];
  visibleTextSample: string;
  typography: TypographySignals;
  structuredContact: ScrapedStructuredContact;
};

function toAbsolute(href: string, base: string): string | null {
  try {
    const u = new URL(href.trim(), base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

function normalizeRequestUrl(raw: string): URL | null {
  const t = raw.trim();
  if (!t) return null;
  let candidate = t;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname) return null;
    return u;
  } catch {
    return null;
  }
}

/** Public https URL for intake display, or null if the string cannot be normalized. */
export function normalizePublicWebsiteUrlForIntake(raw: string): string | null {
  const u = normalizeRequestUrl(raw);
  return u ? u.href : null;
}

function registrableHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function sameOrigin(a: string, b: string): boolean {
  const ha = registrableHost(a);
  const hb = registrableHost(b);
  return ha.length > 0 && ha === hb;
}

function dedupeUrlKey(href: string): string {
  try {
    const u = new URL(href);
    u.hash = "";
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.protocol}//${u.host}${path}${u.search}`.toLowerCase();
  } catch {
    return href.toLowerCase();
  }
}

type BodyReadResult = { buffer: ArrayBuffer; truncated: boolean };

/** Read up to `maxBytes`; when the body exceeds the cap, keep the prefix for partial HTML parse. */
async function readBodyWithByteLimit(
  res: Response,
  maxBytes: number,
): Promise<BodyReadResult> {
  if (!res.body) {
    const buf = await res.arrayBuffer();
    if (buf.byteLength > maxBytes) {
      return { buffer: buf.slice(0, maxBytes), truncated: true };
    }
    return { buffer: buf, truncated: false };
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      if (total + value.byteLength > maxBytes) {
        const keep = maxBytes - total;
        if (keep > 0) {
          chunks.push(value.subarray(0, keep));
          total += keep;
        }
        truncated = true;
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock?.();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return {
    buffer: out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength),
    truncated,
  };
}

function uniqCap<T>(arr: T[], max: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = String(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

function keywordScore(pathAndQuery: string): number {
  const blob = pathAndQuery.toLowerCase();
  let score = 0;
  for (const kw of HIGH_PRIORITY_KEYWORDS) {
    if (blob.includes(kw)) score += 12;
  }
  if (/privacy|terms|cookie|legal|gdpr|login|sign[-_]?in|sign[-_]?up|cart|checkout|account\/|wp-admin/i.test(blob)) {
    score -= 25;
  }
  return score;
}

function classifyPageType(pathname: string): string {
  const p = pathname.toLowerCase();
  if (/about|our-story|company|who-we|team\b/.test(p)) return "about";
  if (/contact|locations?|offices?|get-in-touch|reach-us/.test(p)) return "contact";
  if (/portfolio|our-work|^\/work|case-stud/.test(p)) return "portfolio";
  if (/service|product|solution|offering|menu|shop|store|catalog/.test(p)) return "services";
  return "other";
}

type RankedLink = { url: string; score: number; pageType: string };

function collectSameOriginLinks(html: string, baseFinalUrl: string): RankedLink[] {
  const $ = load(html);
  const homeKey = dedupeUrlKey(baseFinalUrl);
  const seen = new Set<string>();
  const ranked: RankedLink[] = [];

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href || href.startsWith("#")) return;
    const abs = toAbsolute(href, baseFinalUrl);
    if (!abs) return;
    if (!sameOrigin(abs, baseFinalUrl)) return;
    if (BINARY_OR_ASSET_PATH_RE.test(abs)) return;
    const key = dedupeUrlKey(abs);
    if (key === homeKey) return;
    if (seen.has(key)) return;
    seen.add(key);
    let u: URL;
    try {
      u = new URL(abs);
    } catch {
      return;
    }
    const pathQ = `${u.pathname}${u.search}`;
    const score = keywordScore(pathQ);
    const pageType = classifyPageType(u.pathname);
    ranked.push({ url: u.href, score, pageType });
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

/**
 * Pick up to `max` extra URLs: prefer about, then services-ish, then contact/portfolio,
 * then highest keyword score. No recursion — homepage links only.
 */
function selectExtraPageUrls(ranked: RankedLink[], max: number): RankedLink[] {
  const used = new Set<string>();
  const out: RankedLink[] = [];

  const take = (predicate: (r: RankedLink) => boolean) => {
    for (const r of ranked) {
      if (out.length >= max) return;
      const k = dedupeUrlKey(r.url);
      if (used.has(k)) continue;
      if (!predicate(r)) continue;
      used.add(k);
      out.push(r);
    }
  };

  take((r) => r.pageType === "about");
  take((r) => r.pageType === "services");
  take((r) => r.pageType === "contact" || r.pageType === "portfolio");
  take((r) => r.score > 0);
  take(() => true);

  return out.slice(0, max);
}

async function parseHtmlToPageSummary(
  html: string,
  baseFinalUrl: string,
  sourceUrl: string,
  pageTypeHint: string | undefined,
  visibleCap: number,
): Promise<ScrapedPageSummary> {
  const $ = load(html);
  const title = $("title").first().text().replace(/\s+/g, " ").trim();
  const metaDesc =
    $('meta[name="description"]').attr("content")?.trim() ?? "";
  const ogTitle =
    $('meta[property="og:title"]').attr("content")?.trim() ?? "";
  const ogDesc =
    $('meta[property="og:description"]').attr("content")?.trim() ?? "";

  const logoCandidatesDetailed: LogoCandidate[] = [];
  const logoUrlsSeen = new Set<string>();

  const pushLogoCandidate = (
    rawHref: string | undefined,
    source: LogoCandidateSource,
    extras: { alt?: string; width?: number; height?: number } = {},
  ) => {
    if (!rawHref) return;
    const abs = toAbsolute(rawHref, baseFinalUrl);
    if (!abs) return;
    if (logoUrlsSeen.has(abs)) return;
    logoUrlsSeen.add(abs);
    const cleanedAlt = extras.alt
      ? extras.alt.replace(/\s+/g, " ").trim().slice(0, 120)
      : undefined;
    logoCandidatesDetailed.push({
      url: abs,
      source,
      ...(cleanedAlt ? { alt: cleanedAlt } : {}),
      ...(typeof extras.width === "number" && extras.width > 0
        ? { width: Math.round(extras.width) }
        : {}),
      ...(typeof extras.height === "number" && extras.height > 0
        ? { height: Math.round(extras.height) }
        : {}),
    });
  };

  const parseDimAttr = (raw: string | undefined): number | undefined => {
    if (!raw) return undefined;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  for (const el of $('link[href]').toArray()) {
    const rel = ($(el).attr("rel") ?? "").toLowerCase();
    const href = $(el).attr("href") ?? "";
    if (rel === "apple-touch-icon" || rel === "apple-touch-icon-precomposed") {
      pushLogoCandidate(href, "apple-touch-icon");
    } else if (rel.includes("icon")) {
      pushLogoCandidate(href, "icon");
    } else if (rel === "manifest") {
      const manifestHref = href.trim();
      if (!manifestHref) continue;
      try {
        const manifestUrl = toAbsolute(manifestHref, baseFinalUrl);
        if (!manifestUrl) continue;
        const manifestRes = await fetch(manifestUrl, {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(4_000),
          headers: { "User-Agent": SCRAPE_USER_AGENT },
        });
        if (!manifestRes.ok) continue;
        const text = await manifestRes.text();
        if (text.length > 32_000) continue;
        const parsed = JSON.parse(text) as {
          icons?: Array<{ src?: string; sizes?: string }>;
        };
        for (const icon of parsed.icons ?? []) {
          if (typeof icon?.src === "string") {
            pushLogoCandidate(icon.src, "icon", {
              alt: icon.sizes ? `manifest ${icon.sizes}` : "manifest icon",
            });
          }
        }
      } catch {
        /* ignore manifest parse failures */
      }
    }
  }

  const hasLinkedIcon = logoCandidatesDetailed.some(
    (c) => c.source === "icon" || c.source === "apple-touch-icon",
  );
  if (!hasLinkedIcon) {
    try {
      const origin = new URL(baseFinalUrl).origin;
      pushLogoCandidate(`${origin}/favicon.ico`, "icon", { alt: "default favicon" });
    } catch {
      /* ignore */
    }
  }
  pushLogoCandidate(
    $('meta[property="og:image"]').attr("content"),
    "og:image",
    { alt: $('meta[property="og:image:alt"]').attr("content") ?? undefined },
  );
  pushLogoCandidate($('meta[property="og:logo"]').attr("content"), "og:image", {
    alt: "og:logo",
  });
  pushLogoCandidate(
    $('meta[name="twitter:image"]').attr("content"),
    "og:image",
    { alt: "twitter:image",
    },
  );

  /**
   * Header / nav image scan first — only `<img>` inside `header` / `nav` tags or
   * elements whose class/id contains `header`, `nav`, `top` and similar markers.
   * Catches sites whose logo lacks the literal word "logo" in alt/class/id.
   */
  $("header img, nav img").each((_, el) => {
    const $el = $(el);
    const src = $el.attr("src") ?? "";
    if (!src) return;
    pushLogoCandidate(src, "header-image", {
      alt: $el.attr("alt"),
      width: parseDimAttr($el.attr("width")),
      height: parseDimAttr($el.attr("height")),
    });
  });

  const visitJsonLd = (node: unknown) => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      for (const item of node) visitJsonLd(item);
      return;
    }
    if (typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    const absorb = (v: unknown) => {
      if (typeof v === "string" && /^https?:\/\//i.test(v)) {
        pushLogoCandidate(v, "og:image", { alt: "Structured data image" });
        return;
      }
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const img = v as Record<string, unknown>;
        if (typeof img.url === "string") {
          pushLogoCandidate(img.url, "og:image", { alt: "Structured data image" });
        }
      }
    };
    for (const key of ["logo", "image"]) {
      if (key in o) absorb(o[key]);
    }
    for (const v of Object.values(o)) visitJsonLd(v);
  };

  $("script[type='application/ld+json'], script[type=\"application/ld+json\"]").each(
    (_, el) => {
      const raw = $(el).html()?.trim();
      if (!raw) return;
      try {
        visitJsonLd(JSON.parse(raw));
      } catch {
        /* ignore invalid JSON-LD blocks */
      }
    },
  );

  $("img[src], source[src]").each((_, el) => {
    const $el = $(el);
    if ($el.closest("header, nav").length > 0) return;
    const src = $el.attr("src") ?? "";
    if (!src) return;
    const blob = `${src} ${$el.attr("alt") ?? ""} ${$el.attr("class") ?? ""}`.toLowerCase();
    if (!/logo|brand|wordmark/.test(blob)) return;
    if (/enterprise-accordion|nav-bg|testimonial/i.test(blob)) return;
    pushLogoCandidate(src, "img-logo", {
      alt: $el.attr("alt"),
      width: parseDimAttr($el.attr("width")),
      height: parseDimAttr($el.attr("height")),
    });
  });

  /**
   * Generic logo-ish images by attribute matching anywhere in the document.
   */
  $("img").each((_, el) => {
    const $el = $(el);
    const src = $el.attr("src") ?? "";
    if (!src) return;
    const alt = $el.attr("alt") ?? "";
    const id = $el.attr("id") ?? "";
    const cls = $el.attr("class") ?? "";
    const blob = `${src} ${alt} ${id} ${cls}`.toLowerCase();
    if (blob.includes("logo")) {
      if (
        /enterprise-accordion|nav-bg|testimonial|headshot|case-study|sessions-\d/i.test(
          blob,
        )
      ) {
        return;
      }
      if (
        alt.length > 60 &&
        /\b(view of|imitating|forms a|overhead|aerial|exterior|street view)\b/i.test(
          alt,
        )
      ) {
        return;
      }
      pushLogoCandidate(src, "img-logo", {
        alt,
        width: parseDimAttr($el.attr("width")),
        height: parseDimAttr($el.attr("height")),
      });
    }
  });

  const logoCandidates = logoCandidatesDetailed.map((c) => c.url);

  const mailtoHrefs: string[] = [];
  const telHrefs: string[] = [];
  const socialHrefsDiscovered: string[] = [];

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href) return;
    const lower = href.toLowerCase();
    if (lower.startsWith("mailto:")) {
      mailtoHrefs.push(href);
    } else if (lower.startsWith("tel:")) {
      telHrefs.push(href);
    } else {
      try {
        const u = new URL(href, baseFinalUrl);
        if (SOCIAL_HOST_RE.test(u.hostname)) {
          socialHrefsDiscovered.push(u.href);
        }
      } catch {
        /* ignore */
      }
    }
  });

  const structuredFromHtml = extractStructuredContactFromHtml(html);
  for (const href of mailtoHrefs) {
    const email = normalizeEmail(href);
    if (email) structuredFromHtml.emails.push(email);
  }
  for (const href of telHrefs) {
    const phone = normalizePhoneDisplay(href);
    if (phone) structuredFromHtml.phones.push(phone);
  }
  structuredFromHtml.emails = [...new Set(structuredFromHtml.emails)].slice(0, 16);
  structuredFromHtml.phones = [...new Set(structuredFromHtml.phones)].slice(0, 16);

  const socialHrefs = filterBrandProfileSocialUrls(
    uniqCap(socialHrefsDiscovered, MAX_SOCIAL_MERGED),
    {},
    MAX_SOCIAL_MERGED,
  );

  $("script, style, noscript, svg").remove();
  const textSource = $("body").length > 0 ? $("body") : $("html");
  const rawText = textSource.text().replace(/\s+/g, " ").trim();
  const visibleTextSample = rawText.slice(0, visibleCap);

  let pageType = pageTypeHint;
  if (!pageType || pageType === "other") {
    try {
      pageType = classifyPageType(new URL(sourceUrl).pathname);
    } catch {
      pageType = "other";
    }
  }

  const typographyBase = extractTypographyFromHtml(html);
  const typography = await enrichTypographyWithSameOriginCss(
    html,
    baseFinalUrl,
    typographyBase,
  );

  return {
    url: sourceUrl,
    pageType: pageType === "other" ? undefined : pageType,
    title,
    metaDescription: metaDesc,
    ogTitle,
    ogDescription: ogDesc,
    logoCandidateUrls: uniqCap(logoCandidates, MAX_LOGO_CANDIDATES_MERGED),
    logoCandidatesDetailed: logoCandidatesDetailed.slice(
      0,
      MAX_LOGO_CANDIDATES_MERGED,
    ),
    mailtoHrefs: uniqCap(mailtoHrefs, MAX_MAILTO_MERGED),
    telHrefs: uniqCap(telHrefs, MAX_TEL_MERGED),
    socialHrefs,
    socialHrefsDiscovered: uniqCap(socialHrefsDiscovered, MAX_SOCIAL_MERGED),
    structuredEmails: structuredFromHtml.emails,
    structuredPhones: structuredFromHtml.phones,
    structuredAddresses: structuredFromHtml.addresses,
    footerTextSample: structuredFromHtml.footerTextSample,
    visibleTextSample,
    typography,
  };
}

async function fetchHtmlPage(
  url: string,
): Promise<
  | { ok: true; finalUrl: string; html: string; bodyTruncated?: boolean }
  | { ok: false; finalUrl: string; reason: string }
> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_PAGE_FETCH_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": SCRAPE_USER_AGENT,
      },
    });
    const finalUrl = res.url || url;
    if (!res.ok) {
      return { ok: false, finalUrl, reason: `http_${res.status}` };
    }
    const ct = res.headers.get("content-type") ?? "";
    if (ct && !/text\/html|application\/xhtml\+xml/i.test(ct)) {
      return { ok: false, finalUrl, reason: "non_html" };
    }
    const cl = res.headers.get("content-length");
    let contentLengthTruncated = false;
    if (cl) {
      const n = Number(cl);
      if (Number.isFinite(n) && n > MAX_HTML_BYTES) {
        contentLengthTruncated = true;
      }
    }
    const { buffer, truncated } = await readBodyWithByteLimit(
      res,
      MAX_HTML_BYTES,
    );
    const html = new TextDecoder("utf-8", { fatal: false }).decode(
      new Uint8Array(buffer),
    );
    if (!html.trim()) {
      return { ok: false, finalUrl, reason: "empty_body" };
    }
    const bodyTruncated = truncated || contentLengthTruncated;
    return {
      ok: true,
      finalUrl,
      html,
      ...(bodyTruncated ? { bodyTruncated: true } : {}),
    };
  } catch (err) {
    const reason =
      err instanceof Error
        ? err.name === "AbortError"
          ? "timeout"
          : "fetch_error"
        : "fetch_error";
    return { ok: false, finalUrl: url, reason };
  } finally {
    clearTimeout(timer);
  }
}

function mergePageLists(
  pages: ScrapedPageSummary[],
  rankingCtx: LogoRankingContext = { brandTokens: [] },
  websiteUrl?: string,
): {
  logoCandidateUrls: string[];
  logoCandidatesDetailed: LogoCandidate[];
  mailtoHrefs: string[];
  telHrefs: string[];
  socialHrefs: string[];
  socialHrefsDiscovered: string[];
  structuredContact: ScrapedStructuredContact;
} {
  const logos: string[] = [];
  const logoDetailed: LogoCandidate[] = [];
  const logoSeen = new Set<string>();
  const mails: string[] = [];
  const tels: string[] = [];
  const socialsDiscovered: string[] = [];
  const structuredPages: ScrapedStructuredContact[] = [];
  for (const p of pages) {
    logos.push(...p.logoCandidateUrls);
    for (const c of p.logoCandidatesDetailed) {
      if (logoSeen.has(c.url)) {
        const idx = logoDetailed.findIndex((x) => x.url === c.url);
        if (idx >= 0) {
          const prevScore = scoreLogoCandidate(logoDetailed[idx]!, rankingCtx).score;
          const nextScore = scoreLogoCandidate(c, rankingCtx).score;
          if (nextScore > prevScore) {
            logoDetailed[idx] = c;
          }
        }
        continue;
      }
      logoSeen.add(c.url);
      logoDetailed.push(c);
    }
    mails.push(...p.mailtoHrefs);
    tels.push(...p.telHrefs);
    socialsDiscovered.push(...p.socialHrefsDiscovered);
    structuredPages.push({
      emails: p.structuredEmails,
      phones: p.structuredPhones,
      addresses: p.structuredAddresses,
      footerTextSample: p.footerTextSample,
    });
  }
  const structuredContact = mergeStructuredContacts(structuredPages);
  const socialCtx = {
    businessName: rankingCtx.brandTokens.join(" "),
    websiteUrl,
  };
  const socialsFiltered = filterBrandProfileSocialUrls(
    uniqCap(socialsDiscovered, MAX_SOCIAL_MERGED),
    socialCtx,
    MAX_SOCIAL_MERGED,
  );
  return {
    logoCandidateUrls: uniqCap(logos, MAX_LOGO_CANDIDATES_MERGED),
    logoCandidatesDetailed: logoDetailed.slice(0, MAX_LOGO_CANDIDATES_MERGED),
    mailtoHrefs: uniqCap(mails, MAX_MAILTO_MERGED),
    telHrefs: uniqCap(tels, MAX_TEL_MERGED),
    socialHrefs: socialsFiltered,
    socialHrefsDiscovered: uniqCap(socialsDiscovered, MAX_SOCIAL_MERGED),
    structuredContact,
  };
}

function isMostlyDuplicateText(a: string, b: string): boolean {
  if (a.length < 80 || b.length < 80) return false;
  const sample = b.slice(0, 240);
  return a.includes(sample) || b.includes(a.slice(0, 240));
}

function isDupOfPriorPages(
  sample: string,
  homepageText: string,
  prior: ScrapedPageSummary[],
): boolean {
  if (isMostlyDuplicateText(homepageText, sample)) return true;
  for (const p of prior) {
    if (isMostlyDuplicateText(p.visibleTextSample, sample)) return true;
  }
  return false;
}

function countVisibleCharsSentToClaude(
  extraction: WebsiteContentExtraction,
): number {
  const budget = { n: TOTAL_VISIBLE_CONTEXT_CHARS };
  sliceVisibleForBudget(
    extraction.homepage.visibleTextSample,
    HOMEPAGE_VISIBLE_BUDGET,
    budget,
  );
  for (const p of extraction.additionalPages) {
    sliceVisibleForBudget(
      p.visibleTextSample,
      EXTRA_PAGE_VISIBLE_BUDGET,
      budget,
    );
  }
  return TOTAL_VISIBLE_CONTEXT_CHARS - budget.n;
}

function emptySlice(url: string): ScrapedPageSummary {
  return {
    url,
    title: "",
    metaDescription: "",
    ogTitle: "",
    ogDescription: "",
    logoCandidateUrls: [],
    logoCandidatesDetailed: [],
    mailtoHrefs: [],
    telHrefs: [],
    socialHrefs: [],
    socialHrefsDiscovered: [],
    structuredEmails: [],
    structuredPhones: [],
    structuredAddresses: [],
    footerTextSample: "",
    visibleTextSample: "",
    typography: emptyTypographySignals(),
  };
}

function buildScrapeDepthDiagnostics(params: {
  status: WebsiteFetchMeta["status"];
  reason?: string;
  pagesFetched: number;
  pagesFailed: number;
  rankedLinksCount: number;
  picks: RankedLink[];
  pageTypesFound: Set<string>;
}): string[] {
  const codes: string[] = [];
  if (params.reason === "timeout") codes.push("timeout");
  if (params.status === "partial" || params.reason === "body_truncated") {
    codes.push("body_truncated");
  }
  if (params.pagesFailed > 0) codes.push("pages_failed");
  if (params.rankedLinksCount === 0) codes.push("no_same_domain_links");
  const hasContact =
    params.pageTypesFound.has("contact") ||
    params.picks.some((p) => p.pageType === "contact");
  if (!hasContact && params.rankedLinksCount > 0) {
    codes.push("no_contact_pages_found");
  }
  if (params.pagesFetched <= 1) codes.push("scrape_depth_low");
  return codes;
}

function buildFlatExtraction(
  meta: WebsiteFetchMeta,
  homepage: ScrapedPageSummary,
  additionalPages: ScrapedPageSummary[],
  structuredContact?: ScrapedStructuredContact,
): WebsiteContentExtraction {
  const merged = mergePageLists([homepage, ...additionalPages]);
  const contact =
    structuredContact ?? mergeStructuredContacts(
      [homepage, ...additionalPages].map((p) => ({
        emails: p.structuredEmails,
        phones: p.structuredPhones,
        addresses: p.structuredAddresses,
        footerTextSample: p.footerTextSample,
      })),
    );
  return {
    meta,
    homepage,
    additionalPages,
    title: homepage.title,
    metaDescription: homepage.metaDescription,
    ogTitle: homepage.ogTitle,
    ogDescription: homepage.ogDescription,
    logoCandidateUrls: merged.logoCandidateUrls,
    logoCandidatesDetailed: merged.logoCandidatesDetailed,
    mailtoHrefs: merged.mailtoHrefs,
    telHrefs: merged.telHrefs,
    socialHrefs: merged.socialHrefs,
    visibleTextSample: homepage.visibleTextSample,
    typography: mergeTypographyAcrossPages([homepage, ...additionalPages]),
    structuredContact: contact,
  };
}

/**
 * Fetches the homepage plus up to three same-origin linked pages (no crawling beyond
 * those direct fetches). Safe for server-only use.
 */
export async function extractWebsiteContent(
  websiteUrl: string,
): Promise<WebsiteContentExtraction> {
  const normalized = normalizeRequestUrl(websiteUrl);
  if (!normalized) {
    const meta: WebsiteFetchMeta = {
      status: "skipped",
      reason: websiteUrl.trim() ? "invalid_url" : "empty_url",
      pagesAttempted: 0,
      pagesFetched: 0,
      pagesFailed: 0,
    };
    const empty = emptySlice("");
    return buildFlatExtraction(meta, empty, []);
  }

  let pagesAttempted = 0;
  let pagesFetched = 0;
  let pagesFailed = 0;
  const pageTypesFound = new Set<string>();

  try {
    pagesAttempted = 1;
    const homeResult = await fetchHtmlPage(normalized.href);
    if (!homeResult.ok) {
      const failedMeta: WebsiteFetchMeta = {
        status: "failed",
        reason: homeResult.reason,
        finalUrl: homeResult.finalUrl,
        pagesAttempted: 1,
        pagesFetched: 0,
        pagesFailed: 1,
        scrapeDepthDiagnostics: buildScrapeDepthDiagnostics({
          status: "failed",
          reason: homeResult.reason,
          pagesFetched: 0,
          pagesFailed: 1,
          rankedLinksCount: 0,
          picks: [],
          pageTypesFound: new Set(),
        }),
      };
      if (isStaticFetchBlocked(failedMeta)) {
        failedMeta.scrapeDepthDiagnostics = [
          ...new Set([
            ...(failedMeta.scrapeDepthDiagnostics ?? []),
            "blocked",
          ]),
        ];
      }
      const empty = emptySlice(homeResult.finalUrl);
      return buildFlatExtraction(failedMeta, empty, []);
    }

    const homeFinal = homeResult.finalUrl;
    const homeBodyTruncated = homeResult.bodyTruncated === true;
    const homepage = await parseHtmlToPageSummary(
      homeResult.html,
      homeFinal,
      homeFinal,
      undefined,
      MAX_VISIBLE_PARSE_HOMEPAGE,
    );

    const homePathType = classifyPageType(new URL(homeFinal).pathname);
    if (homePathType !== "other") {
      pageTypesFound.add(homePathType);
    }

    const ranked = collectSameOriginLinks(homeResult.html, homeFinal);
    const picks = selectExtraPageUrls(ranked, MAX_EXTRA_PAGES);
    const additionalPages: ScrapedPageSummary[] = [];
    let extraHttpSuccess = 0;

    for (const pick of picks) {
      pagesAttempted += 1;
      const sub = await fetchHtmlPage(pick.url);
      if (!sub.ok) {
        pagesFailed += 1;
        continue;
      }
      extraHttpSuccess += 1;
      const summary = await parseHtmlToPageSummary(
        sub.html,
        sub.finalUrl,
        sub.finalUrl,
        pick.pageType,
        MAX_VISIBLE_PARSE_EXTRA,
      );
      if (isDupOfPriorPages(summary.visibleTextSample, homepage.visibleTextSample, additionalPages)) {
        continue;
      }
      if (pick.pageType && pick.pageType !== "other") {
        pageTypesFound.add(pick.pageType);
      } else if (summary.pageType && summary.pageType !== "other") {
        pageTypesFound.add(summary.pageType);
      }
      additionalPages.push(summary);
    }

    pagesFetched = 1 + extraHttpSuccess;
    const rankingCtx = buildLogoRankingContext({
      finalUrl: homeFinal,
      pageTitle: homepage.title,
      ogTitle: homepage.ogTitle,
    });
    const merged = mergePageLists(
      [homepage, ...additionalPages],
      rankingCtx,
      homeFinal,
    );

    const scrapeDepthDiagnostics = buildScrapeDepthDiagnostics({
      status: homeBodyTruncated ? "partial" : "success",
      reason: homeBodyTruncated ? "body_truncated" : undefined,
      pagesFetched,
      pagesFailed,
      rankedLinksCount: ranked.length,
      picks,
      pageTypesFound,
    });

    const logoCandidatesList = await prepareLogoCandidatesForUi(
      merged.logoCandidatesDetailed,
      MAX_LOGO_CANDIDATES_FOR_UI,
      rankingCtx,
    );
    const typographyMerged = mergeTypographyAcrossPages([
      homepage,
      ...additionalPages,
    ]);
    const flat = buildFlatExtraction(
      {
        status: homeBodyTruncated ? "partial" : "success",
        ...(homeBodyTruncated ? { reason: "body_truncated" } : {}),
        finalUrl: homeFinal,
        titleFound: homepage.title.length > 0,
        textChars: 0,
        logoCandidates: merged.logoCandidateUrls.length,
        logoCandidatesList,
        contactLinks:
          merged.mailtoHrefs.length + merged.telHrefs.length + merged.socialHrefs.length,
        pagesAttempted,
        pagesFetched,
        pagesFailed,
        pageTypesFound:
          pageTypesFound.size > 0 ? Array.from(pageTypesFound).sort() : undefined,
        scrapeDepthDiagnostics,
        socialLinksDiscovered: merged.socialHrefsDiscovered,
        structuredEmailsFound: merged.structuredContact.emails.length,
        structuredPhonesFound: merged.structuredContact.phones.length,
        structuredAddressesFound: merged.structuredContact.addresses.length,
        typography: toWebsiteTypographyMeta(typographyMerged),
      },
      homepage,
      additionalPages,
      merged.structuredContact,
    );
    return {
      ...flat,
      meta: {
        ...flat.meta,
        textChars: countVisibleCharsSentToClaude(flat),
      },
    };
  } catch (err) {
    const reason =
      err instanceof Error
        ? err.name === "AbortError"
          ? "timeout"
          : "fetch_error"
        : "fetch_error";
    const meta: WebsiteFetchMeta = {
      status: "failed",
      reason,
      finalUrl: normalized.href,
      pagesAttempted,
      pagesFetched,
      pagesFailed: Math.max(0, pagesAttempted - pagesFetched),
    };
    const empty = emptySlice(normalized.href);
    return buildFlatExtraction(meta, empty, []);
  }
}

function sliceVisibleForBudget(
  text: string,
  maxForPage: number,
  budgetRemaining: { n: number },
): string {
  const cap = Math.min(maxForPage, budgetRemaining.n, text.length);
  const slice = text.slice(0, cap);
  budgetRemaining.n -= slice.length;
  return slice;
}

/**
 * Builds a bounded multi-page context block for the Claude prompt (server-only; never returned on the public API).
 */
export function formatWebsiteContextForClaude(
  extraction: WebsiteContentExtraction,
): string {
  if (extraction.meta.status !== "success") {
    return `Website fetch: ${extraction.meta.status}${extraction.meta.reason ? ` (${extraction.meta.reason})` : ""}. Use intake fields only for factual contact details unless clearly present in user instructions.`;
  }

  const budget = { n: TOTAL_VISIBLE_CONTEXT_CHARS };
  const lines: string[] = [
    `Website fetch: success. Homepage final URL: ${extraction.meta.finalUrl ?? "(unknown)"}`,
    `Pages attempted: ${extraction.meta.pagesAttempted ?? 1} · Pages fetched successfully: ${extraction.meta.pagesFetched ?? 1} · Pages failed: ${extraction.meta.pagesFailed ?? 0}`,
  ];
  if (extraction.meta.pageTypesFound?.length) {
    lines.push(`Page types detected (heuristic): ${extraction.meta.pageTypesFound.join(", ")}`);
  }
  if (extraction.meta.scrapeDepthDiagnostics?.length) {
    lines.push(
      `Scrape depth diagnostics: ${extraction.meta.scrapeDepthDiagnostics.join(", ")}`,
    );
  }

  lines.push("", "=== Homepage ===");
  const h = extraction.homepage;
  lines.push(`URL: ${h.url}`);
  lines.push(`Page title: ${h.title || "(none)"}`);
  lines.push(`Meta description: ${h.metaDescription || "(none)"}`);
  lines.push(`og:title: ${h.ogTitle || "(none)"}`);
  lines.push(`og:description: ${h.ogDescription || "(none)"}`);
  lines.push(
    `Visible text excerpt (capped):\n${sliceVisibleForBudget(h.visibleTextSample, HOMEPAGE_VISIBLE_BUDGET, budget)}`,
  );

  for (const p of extraction.additionalPages) {
    lines.push("");
    lines.push(
      `=== Additional page${p.pageType ? ` (${p.pageType})` : ""} ===`,
    );
    lines.push(`URL: ${p.url}`);
    lines.push(`Page title: ${p.title || "(none)"}`);
    lines.push(`Meta description: ${p.metaDescription || "(none)"}`);
    lines.push(`og:title: ${p.ogTitle || "(none)"}`);
    lines.push(`og:description: ${p.ogDescription || "(none)"}`);
    lines.push(
      `Visible text excerpt (capped):\n${sliceVisibleForBudget(p.visibleTextSample, EXTRA_PAGE_VISIBLE_BUDGET, budget)}`,
    );
    if (p.footerTextSample.trim()) {
      lines.push(
        `Footer / contact block excerpt (capped):\n${p.footerTextSample.slice(0, 600)}`,
      );
    }
  }

  const structured = extraction.structuredContact;
  lines.push("", "=== Collected across inspected pages (deduped) ===");
  if (extraction.logoCandidateUrls.length) {
    lines.push(
      `Logo / image candidates (URLs, not verified): ${extraction.logoCandidateUrls.join(" | ")}`,
    );
  }
  if (extraction.mailtoHrefs.length) {
    lines.push(`mailto links: ${extraction.mailtoHrefs.join(" | ")}`);
  }
  if (extraction.telHrefs.length) {
    lines.push(`tel links: ${extraction.telHrefs.join(" | ")}`);
  }
  if (structured.emails.length) {
    lines.push(`Structured emails (JSON-LD / mailto): ${structured.emails.join(" | ")}`);
  }
  if (structured.phones.length) {
    lines.push(`Structured phones (JSON-LD / tel): ${structured.phones.join(" | ")}`);
  }
  if (structured.addresses.length) {
    lines.push(`Structured addresses (JSON-LD): ${structured.addresses.join(" | ")}`);
  }
  if (structured.footerTextSample.trim()) {
    lines.push(
      `Combined footer excerpt: ${structured.footerTextSample.slice(0, 800)}`,
    );
  }
  if (extraction.socialHrefs.length) {
    lines.push(`Social profile links (filtered): ${extraction.socialHrefs.join(" | ")}`);
  }
  if (extraction.meta.socialLinksDiscovered?.length) {
    lines.push(
      `Social links discovered (raw, may include share/watch URLs): ${extraction.meta.socialLinksDiscovered.join(" | ")}`,
    );
  }

  const typo = extraction.typography;
  if (
    typo.fontFamilies.length > 0 ||
    typo.googleFontFamilies.length > 0
  ) {
    lines.push("", "=== Typography signals (from HTML/CSS — not exact font files) ===");
    if (typo.googleFontFamilies.length) {
      lines.push(`Google Fonts families (link tags): ${typo.googleFontFamilies.join(", ")}`);
    }
    if (typo.fontFamilies.length) {
      lines.push(`Font families detected: ${typo.fontFamilies.join(", ")}`);
    }
    if (typo.headingFontCandidates.length) {
      lines.push(`Heading font candidates: ${typo.headingFontCandidates.join(", ")}`);
    }
    if (typo.bodyFontCandidates.length) {
      lines.push(`Body font candidates: ${typo.bodyFontCandidates.join(", ")}`);
    }
    lines.push(`Style guess (heuristic): ${typo.styleGuess}`);
    lines.push(
      "Use typography only as a weak hint for brand tone. Do NOT claim exact webfonts are available for print; the canvas uses safe system fallbacks.",
    );
  }

  lines.push(
    "",
    "Use the above when it clearly supports a field (especially services/products copy from visible excerpts). Do NOT invent phone, email, or street address unless they appear in excerpts, explicit mailto/tel links, or the user's special instructions.",
  );
  return lines.join("\n");
}
