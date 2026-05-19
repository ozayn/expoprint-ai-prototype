/**
 * Local re-declaration of the extracted-row key set; intentionally not imported
 * from `designIntakeState` so this helper can be required lazily without any
 * circular module risk.
 */
export type ExtractedKey =
  | "logo"
  | "brandColors"
  | "phone"
  | "email"
  | "address"
  | "social"
  | "services"
  | "products";

/**
 * Prototype text cleanup for `extracted.*` row values returned by Claude after
 * the multi-page Analyze flow. Goal is readable, design-brief-friendly copy:
 * remove punctuation noise, drop garbled fragments, cap list length, and fall
 * back to "" when the result would still be unreadable. Not a content moderator
 * and not a substitute for human review.
 */

const ALLOWED_SHORT_TOKENS = new Set([
  "ai",
  "ar",
  "vr",
  "tv",
  "uk",
  "us",
  "eu",
  "qr",
  "co",
  "id",
  "it",
  "hr",
  "pr",
  "ux",
  "ui",
  "3d",
  "2d",
  "4k",
  "8k",
  "5g",
  "4g",
]);

const MAX_LIST_ITEMS_DEFAULT = 8;
const MAX_LIST_ITEM_CHARS = 64;

function collapseWhitespace(s: string): string {
  return s.replace(/[\u00A0\s]+/g, " ").trim();
}

/**
 * Strips empty parentheses / brackets and runs of comma-only or punctuation-only
 * fragments inside a string, then collapses whitespace.
 */
function stripPunctuationNoise(s: string): string {
  let out = s;
  out = out.replace(/\([\s,;:·•|\.\-]*\)/g, " ");
  out = out.replace(/\[[\s,;:·•|\.\-]*\]/g, " ");

  out = out.replace(/[,;]+\s*[,;]+/g, ", ");
  out = out.replace(/\.{2,}/g, ".");

  out = out.replace(/\(\s*([^()]*?)\s*\)/g, (_, inner: string) => {
    const cleaned = collapseWhitespace(inner.replace(/^[\s,;:·•|\.\-]+|[\s,;:·•|\.\-]+$/g, ""));
    return cleaned.length > 0 ? `(${cleaned})` : " ";
  });

  out = out.replace(/\s+([,;:.!?])/g, "$1");
  out = out.replace(/([,;])\1+/g, "$1");
  out = out.replace(/^[\s,;:·•|.]+|[\s,;:·•|.\-]+$/g, "");

  return collapseWhitespace(out);
}

function looksLikeMeaningfulItem(item: string): boolean {
  const t = item.trim();
  if (!t) return false;

  const letters = (t.match(/[A-Za-z]/g) ?? []).length;
  const digits = (t.match(/[0-9]/g) ?? []).length;
  const punct = (t.match(/[(){}\[\]\.,;:!?\-_|/\\·•]/g) ?? []).length;
  const total = t.length;

  /** Reject items where punctuation dominates over letters and digits. */
  if (punct > 0 && punct >= letters + digits) return false;

  if (letters === 0 && digits === 0) return false;

  if (t.length < 3) {
    return ALLOWED_SHORT_TOKENS.has(t.toLowerCase());
  }

  /** Require a real alphabetic word ≥3 chars, OR a meaningful size token like "10x10". */
  const hasRealWord = /[A-Za-z]{3,}/.test(t);
  const hasSizeToken = /\b\d+\s*[x×]\s*\d+\b/i.test(t);
  if (!hasRealWord && !hasSizeToken) return false;

  /** Reject items where a single character repeats heavily ("aaaaa"). */
  const charCounts = new Map<string, number>();
  for (const ch of t.toLowerCase()) {
    if (/[a-z]/.test(ch)) {
      charCounts.set(ch, (charCounts.get(ch) ?? 0) + 1);
    }
  }
  const maxRepeat = Math.max(0, ...Array.from(charCounts.values()));
  if (letters >= 6 && maxRepeat / letters > 0.7) return false;

  /** Reject "obvious" navigation noise that survived cleanup. */
  if (/^(home|menu|sign[-_ ]?in|sign[-_ ]?up|log[-_ ]?in|log[-_ ]?out|cart|account|search)$/i.test(t)) {
    return false;
  }

  if (total > MAX_LIST_ITEM_CHARS) return false;

  return true;
}

function dedupeCaseInsensitive(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Splits a list-style string on common separators, cleans each item, drops noise,
 * dedupes, and caps total count. Returns `""` if the result is too low-quality.
 */
export function cleanListLikeValue(
  raw: string,
  opts: { maxItems?: number } = {},
): string {
  const maxItems = opts.maxItems ?? MAX_LIST_ITEMS_DEFAULT;
  const collapsed = stripPunctuationNoise(collapseWhitespace(raw));
  if (!collapsed) return "";

  const parts = collapsed
    .split(/\s*[,;]\s*/)
    .flatMap((chunk) => chunk.split(/\s*[·•|]\s*/))
    .map((p) => stripPunctuationNoise(p))
    .map((p) => p.replace(/^[\s,;:·•|.\-]+|[\s,;:·•|.\-]+$/g, "").trim())
    .filter(Boolean);

  const kept = parts.filter(looksLikeMeaningfulItem);
  const deduped = dedupeCaseInsensitive(kept).slice(0, maxItems);

  if (deduped.length === 0) return "";

  /**
   * If almost everything got rejected (e.g. heavy punctuation soup), treat as
   * unreliable and return "" rather than show a single recovered fragment.
   */
  if (parts.length >= 4 && deduped.length === 1 && parts.length - deduped.length >= 4) {
    return "";
  }

  return deduped.join(", ");
}

/**
 * Free-text fields (logo description, address, etc.). Lighter cleanup: collapse
 * whitespace, remove empty parens/repeated punctuation, but no list splitting.
 */
function cleanFreeText(raw: string): string {
  const out = stripPunctuationNoise(collapseWhitespace(raw));
  if (!out) return "";

  const letters = (out.match(/[A-Za-z]/g) ?? []).length;
  const punct = (out.match(/[(){}\[\]\.,;:!?\-_|/\\·•]/g) ?? []).length;
  if (letters < 3) return "";
  if (punct > letters * 1.2) return "";
  return out;
}

/**
 * Phone: keep digits, +, (, ), -, space; collapse runs of whitespace.
 */
function cleanPhone(raw: string): string {
  const t = collapseWhitespace(raw.replace(/[^\d+()\-\s.,/extx]/gi, ""));
  const digits = (t.match(/\d/g) ?? []).length;
  if (digits < 7) return "";
  return t.replace(/\s{2,}/g, " ").trim();
}

/**
 * Email: keep first plausibly valid token; otherwise "".
 */
function cleanEmail(raw: string): string {
  const m = raw.match(/[\w.+\-]+@[\w\-]+\.[\w.\-]+/);
  return m ? m[0].trim() : "";
}

/**
 * Social / addresses: keep printable chars, strip empty-paren noise, collapse.
 */
function cleanLooseLine(raw: string): string {
  return cleanFreeText(raw);
}

/**
 * Brand colors: hex tokens / human labels, no list collapsing, but trim noise.
 */
function cleanBrandColors(raw: string): string {
  const collapsed = stripPunctuationNoise(collapseWhitespace(raw));
  return collapsed;
}

/**
 * Per-field cleanup table. Always returns a string (possibly `""`). Caller can
 * decide whether `useForDesign` should flip off when the value clears.
 */
export function cleanExtractedRowValue(key: ExtractedKey, raw: string): string {
  const t = (raw ?? "").toString();
  if (!t.trim()) return "";

  switch (key) {
    case "services":
      return cleanListLikeValue(t, { maxItems: 6 });
    case "products":
      return cleanListLikeValue(t, { maxItems: 6 });
    case "social":
      return cleanLooseLine(t);
    case "address":
      return cleanLooseLine(t);
    case "phone":
      return cleanPhone(t);
    case "email":
      return cleanEmail(t);
    case "brandColors":
      return cleanBrandColors(t);
    case "logo":
      return cleanFreeText(t);
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}
