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

async function readBodyWithByteLimit(
  res: Response,
  maxBytes: number,
): Promise<ArrayBuffer> {
  if (!res.body) {
    const buf = await res.arrayBuffer();
    if (buf.byteLength > maxBytes) {
      throw new Error("body_too_large");
    }
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new Error("body_too_large");
      }
      chunks.push(value);
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
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
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

function parseHtmlToPageSummary(
  html: string,
  baseFinalUrl: string,
  sourceUrl: string,
  pageTypeHint: string | undefined,
  visibleCap: number,
): ScrapedPageSummary {
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

  $('link[href]').each((_, el) => {
    const rel = ($(el).attr("rel") ?? "").toLowerCase();
    const href = $(el).attr("href") ?? "";
    if (rel === "apple-touch-icon" || rel === "apple-touch-icon-precomposed") {
      pushLogoCandidate(href, "apple-touch-icon");
    } else if (rel.includes("icon")) {
      pushLogoCandidate(href, "icon");
    }
  });
  pushLogoCandidate(
    $('meta[property="og:image"]').attr("content"),
    "og:image",
    { alt: $('meta[property="og:image:alt"]').attr("content") ?? undefined },
  );

  const parseDimAttr = (raw: string | undefined): number | undefined => {
    if (!raw) return undefined;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

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
  const socialHrefs: string[] = [];

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
          socialHrefs.push(u.href);
        }
      } catch {
        /* ignore */
      }
    }
  });

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
    socialHrefs: uniqCap(socialHrefs, MAX_SOCIAL_MERGED),
    visibleTextSample,
  };
}

async function fetchHtmlPage(
  url: string,
): Promise<
  | { ok: true; finalUrl: string; html: string }
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
        "User-Agent":
          "ExpoPrintAI-Prototype/1.0 (+https://github.com/ozayn/expoprint-ai-prototype)",
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
    if (cl) {
      const n = Number(cl);
      if (Number.isFinite(n) && n > MAX_HTML_BYTES) {
        return { ok: false, finalUrl, reason: "body_too_large" };
      }
    }
    const buf = await readBodyWithByteLimit(res, MAX_HTML_BYTES);
    const html = new TextDecoder("utf-8", { fatal: false }).decode(
      new Uint8Array(buf),
    );
    return { ok: true, finalUrl, html };
  } catch (err) {
    const reason =
      err instanceof Error
        ? err.name === "AbortError"
          ? "timeout"
          : err.message === "body_too_large"
            ? "body_too_large"
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
): {
  logoCandidateUrls: string[];
  logoCandidatesDetailed: LogoCandidate[];
  mailtoHrefs: string[];
  telHrefs: string[];
  socialHrefs: string[];
} {
  const logos: string[] = [];
  const logoDetailed: LogoCandidate[] = [];
  const logoSeen = new Set<string>();
  const mails: string[] = [];
  const tels: string[] = [];
  const socials: string[] = [];
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
    socials.push(...p.socialHrefs);
  }
  return {
    logoCandidateUrls: uniqCap(logos, MAX_LOGO_CANDIDATES_MERGED),
    logoCandidatesDetailed: logoDetailed.slice(0, MAX_LOGO_CANDIDATES_MERGED),
    mailtoHrefs: uniqCap(mails, MAX_MAILTO_MERGED),
    telHrefs: uniqCap(tels, MAX_TEL_MERGED),
    socialHrefs: uniqCap(socials, MAX_SOCIAL_MERGED),
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
    visibleTextSample: "",
  };
}

function buildFlatExtraction(
  meta: WebsiteFetchMeta,
  homepage: ScrapedPageSummary,
  additionalPages: ScrapedPageSummary[],
): WebsiteContentExtraction {
  const merged = mergePageLists([homepage, ...additionalPages]);
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
      const meta: WebsiteFetchMeta = {
        status: "failed",
        reason: homeResult.reason,
        finalUrl: homeResult.finalUrl,
        pagesAttempted: 1,
        pagesFetched: 0,
        pagesFailed: 1,
      };
      const empty = emptySlice(homeResult.finalUrl);
      return buildFlatExtraction(meta, empty, []);
    }

    const homeFinal = homeResult.finalUrl;
    const homepage = parseHtmlToPageSummary(
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
      const summary = parseHtmlToPageSummary(
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
    const merged = mergePageLists([homepage, ...additionalPages], rankingCtx);

    const logoCandidatesList = await prepareLogoCandidatesForUi(
      merged.logoCandidatesDetailed,
      MAX_LOGO_CANDIDATES_FOR_UI,
      rankingCtx,
    );
    const flat = buildFlatExtraction(
      {
        status: "success",
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
      },
      homepage,
      additionalPages,
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
          : err.message === "body_too_large"
            ? "body_too_large"
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
  }

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
  if (extraction.socialHrefs.length) {
    lines.push(`Social links found: ${extraction.socialHrefs.join(" | ")}`);
  }

  lines.push(
    "",
    "Use the above when it clearly supports a field (especially services/products copy from visible excerpts). Do NOT invent phone, email, or street address unless they appear in excerpts, explicit mailto/tel links, or the user's special instructions.",
  );
  return lines.join("\n");
}
