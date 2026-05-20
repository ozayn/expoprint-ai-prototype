import type {
  LogoCandidate,
  LogoCandidateSource,
  LogoCandidateTransparency,
} from "@/lib/analyzeWebsiteResponse";

export type ScoredLogoCandidate = LogoCandidate & {
  score: number;
  transparency: LogoCandidateTransparency;
  reason?: string;
};

/** Hints for brand/wordmark matching (hostname, page title, optional business name). */
export type LogoRankingContext = {
  brandTokens: string[];
};

const LOGOISH_PATH_RE = /logo|brand|mark|identity|wordmark/i;
const JPEG_EXT_RE = /\.(jpe?g)(?:$|\?)/i;
const SVG_EXT_RE = /\.svg(?:$|\?)/i;
const PNG_EXT_RE = /\.png(?:png)?(?:$|\?)/i;
const WEBP_EXT_RE = /\.webp(?:$|\?)/i;

const PRODUCT_APP_HINT_RE =
  /\b(chrome|chromium|docs?|documents|sheets|slides|maps|youtube|gmail|android|workspace|playstore|play-store|app-store|drive|calendar|meet|photos|news|wallet|pay|assistant|gemini|earth|translate|classroom|keep|podcasts|wear|fit|chat|hangouts|duo|voice|contacts|lens|arts|books|games|pixel|nest|fi\b|tv\b|one\b|account|myaccount|product|app-icon|appicon|sprite|favicon-\d)\b/i;

const PRODUCT_PATH_RE =
  /\/(chrome|docs|sheets|slides|maps|youtube|gmail|android|workspace|drive|calendar|meet|photos|news|play|store|apps?|products?|images\/branding\/product|intl\/[a-z]{2}\/about\/products)\//i;

const TITLE_STOPWORDS = new Set([
  "home",
  "official",
  "site",
  "website",
  "welcome",
  "the",
  "and",
  "for",
  "inc",
  "llc",
  "ltd",
  "corp",
  "co",
]);

export function brandTokensFromHostname(url: string): string[] {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    const label = host.split(".")[0] ?? "";
    if (label.length >= 3 && !TITLE_STOPWORDS.has(label)) {
      return [label];
    }
    if (label.length >= 2 && label.length <= 2) {
      return [label];
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function brandTokensFromTitles(...titles: string[]): string[] {
  const tokens = new Set<string>();
  for (const raw of titles) {
    const t = raw.replace(/\s+/g, " ").trim().toLowerCase();
    if (!t) continue;
    const beforeDash = t.split(/\s*[|\-–—]\s*/)[0] ?? t;
    for (const word of beforeDash.split(/[^a-z0-9]+/)) {
      const w = word.trim();
      if (w.length < 2 || TITLE_STOPWORDS.has(w)) continue;
      tokens.add(w);
    }
  }
  return [...tokens];
}

export function buildLogoRankingContext(options: {
  finalUrl?: string;
  pageTitle?: string;
  ogTitle?: string;
  businessName?: string;
}): LogoRankingContext {
  const tokens = new Set<string>();
  if (options.finalUrl) {
    for (const t of brandTokensFromHostname(options.finalUrl)) tokens.add(t);
  }
  for (const t of brandTokensFromTitles(
    options.pageTitle ?? "",
    options.ogTitle ?? "",
    options.businessName ?? "",
  )) {
    tokens.add(t);
  }
  return { brandTokens: [...tokens] };
}

function fileExtension(url: string): string {
  try {
    const path = new URL(url).pathname.toLowerCase();
    const match = path.match(/\.([a-z0-9]+)(?:$|\?)/i);
    return match?.[1] ?? "";
  } catch {
    return "";
  }
}

function candidateTextBlob(candidate: LogoCandidate): string {
  return `${candidate.url} ${candidate.alt ?? ""}`.toLowerCase();
}

/** Path + alt only — avoids treating the site hostname as brand evidence on every URL. */
function candidateBrandBlob(candidate: LogoCandidate): string {
  const alt = (candidate.alt ?? "").toLowerCase();
  try {
    const u = new URL(candidate.url);
    return `${alt} ${u.pathname} ${u.search}`.toLowerCase();
  } catch {
    return `${alt} ${candidate.url}`.toLowerCase();
  }
}

function urlLooksLogoish(url: string): boolean {
  try {
    const u = new URL(url);
    return LOGOISH_PATH_RE.test(`${u.pathname}${u.search}`);
  } catch {
    return LOGOISH_PATH_RE.test(url);
  }
}

function brandTokenMatches(blob: string, token: string): boolean {
  if (token.length < 2) return false;
  if (token.length <= 3) {
    return new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
      blob,
    );
  }
  return blob.includes(token);
}

function hasBrandNameEvidence(
  candidate: LogoCandidate,
  ctx: LogoRankingContext,
): boolean {
  const blob = candidateBrandBlob(candidate);
  return ctx.brandTokens.some((t) => brandTokenMatches(blob, t));
}

/** Whether an og:image is plausibly a logo mark vs. a generic share/hero image. */
export function ogImageLooksLogoLike(
  candidate: LogoCandidate,
  ctx: LogoRankingContext = { brandTokens: [] },
): boolean {
  if (candidate.source !== "og:image") return false;
  const alt = (candidate.alt ?? "").toLowerCase();
  if (alt.includes("logo")) return true;
  if (urlLooksLogoish(candidate.url)) return true;
  if (hasBrandNameEvidence(candidate, ctx)) return true;
  const { width, height } = candidate;
  if (
    typeof width === "number" &&
    typeof height === "number" &&
    width >= 40 &&
    width <= 520 &&
    height >= 40 &&
    height <= 520
  ) {
    const ratio = width / height;
    if (ratio >= 0.45 && ratio <= 2.2) return true;
  }
  return false;
}

function looksLikeProductAppIcon(candidate: LogoCandidate): boolean {
  const blob = candidateTextBlob(candidate);
  if (PRODUCT_APP_HINT_RE.test(blob) || PRODUCT_PATH_RE.test(candidate.url)) {
    return true;
  }
  const { width, height } = candidate;
  if (
    typeof width === "number" &&
    typeof height === "number" &&
    width >= 36 &&
    width <= 200 &&
    height >= 36 &&
    height <= 200
  ) {
    const ratio = width / height;
    const squareish = ratio >= 0.86 && ratio <= 1.14;
    const isFaviconFallback =
      candidate.source === "icon" || candidate.source === "apple-touch-icon";
    if (squareish && !isFaviconFallback) {
      if (
        PRODUCT_APP_HINT_RE.test(blob) ||
        /\/(images|static|assets)\/.*\/(icon|logo_|product)/i.test(candidate.url)
      ) {
        return true;
      }
    }
  }
  return false;
}

function looksLikeWordmarkDimensions(candidate: LogoCandidate): boolean {
  const { width, height } = candidate;
  if (typeof width !== "number" || typeof height !== "number") return false;
  if (width < 72 || height < 20 || height > 160) return false;
  const ratio = width / height;
  return ratio >= 1.6 && ratio <= 6.5;
}

function baseScoreForSource(
  source: LogoCandidateSource,
  candidate: LogoCandidate,
  ctx: LogoRankingContext,
): { points: number; label: string } {
  switch (source) {
    case "img-logo":
      return { points: 72, label: "logo-tagged image" };
    case "header-image":
      return { points: 80, label: "header/nav image" };
    case "og:image":
      return ogImageLooksLogoLike(candidate, ctx)
        ? { points: 38, label: "og:image (logo-like)" }
        : { points: 10, label: "og:image (generic)" };
    case "apple-touch-icon":
      return { points: 28, label: "apple-touch-icon (fallback)" };
    case "icon":
      return { points: 18, label: "favicon/icon (fallback)" };
    default:
      return { points: 6, label: "image" };
  }
}

function inferTransparencyFromUrl(
  candidate: LogoCandidate,
): LogoCandidateTransparency {
  const ext = fileExtension(candidate.url);
  if (SVG_EXT_RE.test(candidate.url) || ext === "svg") {
    return "likely_transparent";
  }
  if (JPEG_EXT_RE.test(candidate.url) || ext === "jpg" || ext === "jpeg") {
    return "likely_opaque";
  }
  if (PNG_EXT_RE.test(candidate.url) || WEBP_EXT_RE.test(candidate.url)) {
    return "unknown";
  }
  return "unknown";
}

/**
 * Score for design placement. Brand/wordmark evidence is primary; transparency
 * is a small bonus applied later in {@link applyTransparencyBonus}.
 */
export function scoreLogoCandidate(
  candidate: LogoCandidate,
  ctx: LogoRankingContext = { brandTokens: [] },
): ScoredLogoCandidate {
  const reasons: string[] = [];
  const { points: sourcePoints, label: sourceLabel } = baseScoreForSource(
    candidate.source,
    candidate,
    ctx,
  );
  let score = sourcePoints;
  reasons.push(sourceLabel);

  const blob = candidateTextBlob(candidate);
  const alt = (candidate.alt ?? "").toLowerCase();

  if (hasBrandNameEvidence(candidate, ctx)) {
    score += 42;
    reasons.push("brand name in alt/URL");
  }
  if (alt.includes("logo") || /\blogo\b/i.test(blob)) {
    score += 18;
    reasons.push("logo in alt or path");
  }
  if (urlLooksLogoish(candidate.url)) {
    score += 10;
    reasons.push("logo-like path");
  }

  const ext = fileExtension(candidate.url);
  if (ext === "svg" || SVG_EXT_RE.test(candidate.url)) {
    score += 16;
    reasons.push("SVG wordmark/logo");
  } else if (ext === "png") {
    score += 6;
    reasons.push("PNG");
  } else if (ext === "webp") {
    score += 4;
    reasons.push("WebP");
  } else if (ext === "jpg" || ext === "jpeg") {
    score -= 12;
    reasons.push("JPEG (often photo)");
  }

  if (looksLikeWordmarkDimensions(candidate)) {
    score += 14;
    reasons.push("wordmark proportions");
  }

  if (looksLikeProductAppIcon(candidate)) {
    score -= 55;
    reasons.push("penalized: product/app icon");
  }

  const { width, height } = candidate;
  if (typeof width === "number" && width > 640) {
    score -= 16;
    reasons.push("very wide");
  }
  if (typeof height === "number" && height > 420) {
    score -= 12;
    reasons.push("very tall");
  }

  const transparency = inferTransparencyFromUrl(candidate);

  return {
    ...candidate,
    score: Math.round(score),
    transparency,
    reason: reasons.join("; "),
  };
}

/** Sort by score descending; stable tie-break keeps earlier discovery order. */
export function sortLogoCandidatesByScore(
  candidates: LogoCandidate[],
  ctx: LogoRankingContext = { brandTokens: [] },
): ScoredLogoCandidate[] {
  const scored = candidates.map((c, index) => ({
    ...scoreLogoCandidate(c, ctx),
    _order: index,
  }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a._order - b._order;
  });
  return scored.map((row) => {
    const { _order, ...rest } = row;
    void _order;
    return rest;
  });
}

/** Small secondary boost — must not outweigh brand/wordmark signals. */
export function applyTransparencyBonus(
  candidate: ScoredLogoCandidate,
): ScoredLogoCandidate {
  let score = candidate.score;
  const reasons = candidate.reason ? [candidate.reason] : [];
  if (candidate.transparency === "likely_transparent") {
    score += 4;
    if (SVG_EXT_RE.test(candidate.url)) {
      reasons.push("likely transparent SVG");
    } else {
      reasons.push("likely transparent");
    }
  } else if (candidate.transparency === "likely_opaque") {
    score -= 4;
  }
  return {
    ...candidate,
    score: Math.round(score),
    reason: reasons.join("; "),
  };
}

export function resortScoredCandidates(
  candidates: ScoredLogoCandidate[],
): ScoredLogoCandidate[] {
  return [...candidates].sort((a, b) => b.score - a.score);
}
