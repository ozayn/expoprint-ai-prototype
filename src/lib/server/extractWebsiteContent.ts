import { load } from "cheerio";
import type { WebsiteFetchMeta } from "@/lib/analyzeWebsiteResponse";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 800_000;
const MAX_VISIBLE_TEXT_CHARS = 14_000;
const MAX_LOGO_CANDIDATES = 10;
const MAX_MAILTO = 12;
const MAX_TEL = 12;
const MAX_SOCIAL = 16;

const SOCIAL_HOST_RE =
  /(instagram\.com|facebook\.com|fb\.com|linkedin\.com|twitter\.com|x\.com|youtube\.com)/i;

export type WebsiteContentExtraction = {
  meta: WebsiteFetchMeta;
  title: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  logoCandidateUrls: string[];
  mailtoHrefs: string[];
  telHrefs: string[];
  socialHrefs: string[];
  /** Capped plain text for Claude only — not returned on the public API. */
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

function emptyExtraction(meta: WebsiteFetchMeta): WebsiteContentExtraction {
  return {
    meta,
    title: "",
    metaDescription: "",
    ogTitle: "",
    ogDescription: "",
    logoCandidateUrls: [],
    mailtoHrefs: [],
    telHrefs: [],
    socialHrefs: [],
    visibleTextSample: "",
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

/**
 * Fetches and parses a single homepage (no crawling). Safe for server-only use.
 */
export async function extractWebsiteContent(
  websiteUrl: string,
): Promise<WebsiteContentExtraction> {
  const normalized = normalizeRequestUrl(websiteUrl);
  if (!normalized) {
    return emptyExtraction({
      status: "skipped",
      reason: websiteUrl.trim() ? "invalid_url" : "empty_url",
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(normalized.href, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "ExpoPrintAI-Prototype/1.0 (+https://github.com/ozayn/expoprint-ai-prototype)",
      },
    });

    const finalUrl = res.url || normalized.href;

    if (!res.ok) {
      return emptyExtraction({
        status: "failed",
        reason: `http_${res.status}`,
        finalUrl,
      });
    }

    const cl = res.headers.get("content-length");
    if (cl) {
      const n = Number(cl);
      if (Number.isFinite(n) && n > MAX_HTML_BYTES) {
        return emptyExtraction({
          status: "failed",
          reason: "body_too_large",
          finalUrl,
        });
      }
    }

    const buf = await readBodyWithByteLimit(res, MAX_HTML_BYTES);
    const html = new TextDecoder("utf-8", { fatal: false }).decode(
      new Uint8Array(buf),
    );

    const $ = load(html);
    const title = $("title").first().text().replace(/\s+/g, " ").trim();

    const metaDesc =
      $('meta[name="description"]').attr("content")?.trim() ?? "";
    const ogTitle =
      $('meta[property="og:title"]').attr("content")?.trim() ?? "";
    const ogDesc =
      $('meta[property="og:description"]').attr("content")?.trim() ?? "";

    const logoCandidates: string[] = [];
    const pushLogo = (href: string | undefined) => {
      if (!href) return;
      const abs = toAbsolute(href, finalUrl);
      if (abs) logoCandidates.push(abs);
    };

    $('link[href]').each((_, el) => {
      const rel = ($(el).attr("rel") ?? "").toLowerCase();
      if (rel.includes("icon") || rel === "apple-touch-icon") {
        pushLogo($(el).attr("href"));
      }
    });
    pushLogo($('meta[property="og:image"]').attr("content"));

    $("img").each((_, el) => {
      const $el = $(el);
      const src = $el.attr("src") ?? "";
      const alt = $el.attr("alt") ?? "";
      const id = $el.attr("id") ?? "";
      const cls = $el.attr("class") ?? "";
      const blob = `${src} ${alt} ${id} ${cls}`.toLowerCase();
      if (blob.includes("logo")) {
        pushLogo(src);
      }
    });

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
          const u = new URL(href, finalUrl);
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
    const visibleTextSample = rawText.slice(0, MAX_VISIBLE_TEXT_CHARS);

    const uLogos = uniqCap(logoCandidates, MAX_LOGO_CANDIDATES);
    const uMail = uniqCap(mailtoHrefs, MAX_MAILTO);
    const uTel = uniqCap(telHrefs, MAX_TEL);
    const uSoc = uniqCap(socialHrefs, MAX_SOCIAL);

    const meta: WebsiteFetchMeta = {
      status: "success",
      finalUrl,
      titleFound: title.length > 0,
      textChars: visibleTextSample.length,
      logoCandidates: uLogos.length,
      contactLinks: uMail.length + uTel.length + uSoc.length,
    };

    return {
      meta,
      title,
      metaDescription: metaDesc,
      ogTitle,
      ogDescription: ogDesc,
      logoCandidateUrls: uLogos,
      mailtoHrefs: uMail,
      telHrefs: uTel,
      socialHrefs: uSoc,
      visibleTextSample,
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
    return emptyExtraction({
      status: "failed",
      reason,
      finalUrl: normalized.href,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Builds a bounded block of homepage-derived context for the Claude prompt (never logged verbatim in dev helpers).
 */
export function formatWebsiteContextForClaude(
  extraction: WebsiteContentExtraction,
): string {
  if (extraction.meta.status !== "success") {
    return `Homepage fetch: ${extraction.meta.status}${extraction.meta.reason ? ` (${extraction.meta.reason})` : ""}. Use intake fields only for factual contact details unless clearly present in user instructions.`;
  }

  const lines: string[] = [
    `Homepage fetch: success. Final URL: ${extraction.meta.finalUrl ?? "(unknown)"}`,
    `Page title: ${extraction.title || "(none)"}`,
    `Meta description: ${extraction.metaDescription || "(none)"}`,
    `og:title: ${extraction.ogTitle || "(none)"}`,
    `og:description: ${extraction.ogDescription || "(none)"}`,
  ];
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
    `Visible text excerpt (truncated, may be noisy):\n${extraction.visibleTextSample}`,
  );
  lines.push(
    "Use the above when it clearly supports a field. Do NOT invent phone, email, or street address unless they appear in this excerpt, explicit mailto/tel links, or the user's special instructions.",
  );
  return lines.join("\n");
}
