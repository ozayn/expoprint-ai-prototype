/**
 * Display normalization for services/products bullet lines on the canvas.
 * Sentence case with preserved brands, acronyms, and size tokens.
 */

const MAX_BULLET_PHRASE_CHARS = 48;
const DIMENSION_TOKEN_RE = /^\d+\s*[x×]\s*\d+$/i;
/** Short all-caps tokens only (e.g. UV, LED) — not shouting-case words like TRADE. */
const ACRONYM_RE = /^[A-Z]{2,3}$/;
const MIXED_NUMBER_SUFFIX_RE = /^(\d+)([a-zA-Z]{1,4})$/;
/** Brand-style tokens (QuickPop, ExpoPrint) — requires lowercase between capitals. */
const CAMEL_BRAND_RE = /^[A-Z][a-z0-9]+[A-Z][a-zA-Z0-9]*$/;

function collapseWhitespace(s: string): string {
  return s.replace(/[\u00A0\s]+/g, " ").trim();
}

function normalizeDimensionToken(word: string): string {
  return word.replace(/(\d+)\s*x\s*(\d+)/gi, "$1×$2");
}

function formatBulletWord(word: string, isFirstWord: boolean): string {
  const w = word.replace(/^['"]+|['"]+$/g, "");
  if (!w) return w;

  if (DIMENSION_TOKEN_RE.test(w)) {
    return normalizeDimensionToken(w);
  }

  const mixed = w.match(MIXED_NUMBER_SUFFIX_RE);
  if (mixed) {
    const [, num, letters] = mixed;
    return (
      num +
      letters.charAt(0).toUpperCase() +
      letters.slice(1).toLowerCase()
    );
  }

  if (ACRONYM_RE.test(w)) return w;
  if (CAMEL_BRAND_RE.test(w)) return w;

  if (isFirstWord) {
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }

  return w.toLowerCase();
}

/**
 * Sentence case for a short service/product bullet phrase.
 * Capitalizes the first word only; keeps brands, acronyms, and dimensions.
 */
export function normalizeBulletPhrase(raw: string): string {
  const stripped = collapseWhitespace(raw).replace(/\.+$/g, "").trim();
  if (!stripped) return "";

  const words = stripped.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  return words
    .map((word, index) => formatBulletWord(word, index === 0))
    .join(" ");
}

/**
 * Normalize, dedupe, and cap bullet phrases for canvas display (max 3–5 items).
 */
export function normalizeBulletPhrasesForDisplay(
  items: string[],
  maxItems = 5,
): string[] {
  const cap = Math.min(Math.max(maxItems, 1), 5);
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of items) {
    const phrase = normalizeBulletPhrase(raw);
    if (!phrase || phrase.length < 3) continue;
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const trimmed =
      phrase.length > MAX_BULLET_PHRASE_CHARS
        ? `${phrase.slice(0, MAX_BULLET_PHRASE_CHARS - 1).trimEnd()}…`
        : phrase;
    out.push(trimmed);
    if (out.length >= cap) break;
  }

  return out;
}
