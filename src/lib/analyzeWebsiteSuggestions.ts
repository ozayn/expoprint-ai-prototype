import type { LogoCandidate } from "./analyzeWebsiteResponse";
import {
  isNewAnalyzedWebsite,
  normalizeDomainForComparison,
} from "./analyzeWebsiteDomain";
import type { DesignIntakeState, ExtractedKey, ExtractedRow } from "./designIntakeState";
import { sanitizeTypographySignals } from "@/lib/typographyFontCleanup";
import type { TypographySignals, WebsiteTypographyMeta } from "./typographySignals";
import {
  buildMockExtracted,
  computeDesignBriefText,
  DEFAULT_DEMO_BUSINESS_NAME,
  emptyExtracted,
  type ExtractionSource,
} from "./designIntakeState";

/**
 * Intake merge helpers after `POST /api/analyze-website` — used by `/` and `/demo`.
 * Analyze responses come from the same `runClaudeWebsiteAnalyze` pipeline as `/api/design-intake/extract`.
 */

/** True when Analyze may replace the main business name field with Claude output. */
export function businessNameIsAutoFillable(current: string): boolean {
  const t = current.trim();
  return t.length === 0 || t === DEFAULT_DEMO_BUSINESS_NAME;
}

/**
 * When true, replace `websiteUrl` with `suggestedCanonical` (e.g. add https://,
 * or follow redirect final URL) without overriding a clearly different host.
 */
export function shouldApplyCanonicalWebsiteUrl(
  currentUrl: string,
  suggestedCanonical: string,
): boolean {
  const sug = suggestedCanonical.trim();
  if (!sug) return false;
  const cur = currentUrl.trim();
  if (!cur) return true;
  const hCur = normalizeDomainForComparison(cur);
  const hSug = normalizeDomainForComparison(sug);
  if (hCur && hSug && hCur === hSug) return true;
  return false;
}

export type AnalyzeSuggestionFields = {
  suggestedBusinessName: string;
  suggestedWebsiteDomain: string;
  suggestedCanonicalWebsiteUrl: string;
};

export function readAnalyzeSuggestionFields(rec: Record<string, unknown>): {
  suggestedBusinessName: string;
  suggestedWebsiteDomain: string;
  suggestedCanonicalWebsiteUrl: string;
} {
  const str = (k: string) =>
    typeof rec[k] === "string" ? (rec[k] as string).trim() : "";
  return {
    suggestedBusinessName: str("suggestedBusinessName"),
    suggestedWebsiteDomain: str("suggestedWebsiteDomain"),
    suggestedCanonicalWebsiteUrl: str("suggestedCanonicalWebsiteUrl"),
  };
}

export const BUSINESS_NAME_AUTO_UPDATE_NOTE =
  "Business name updated from website analysis.";

export const NEW_WEBSITE_ANALYZE_NOTE =
  "Updated intake from new website analysis.";

type ExtractedMerge =
  | { mode: "replace"; extracted: Record<ExtractedKey, ExtractedRow> }
  | { mode: "keep" }
  | { mode: "clear" };

function websiteChangedForSubmission(
  prev: DesignIntakeState,
  submittedWebsiteUrl: string,
): boolean {
  const previous =
    prev.lastAnalyzedDomain.trim() || prev.lastAnalyzedWebsiteUrl.trim();
  return isNewAnalyzedWebsite(previous, submittedWebsiteUrl);
}

function resolveLastAnalyzedTracking(
  nextWebsiteUrl: string,
  submittedWebsiteUrl: string,
  rec: Record<string, unknown>,
): { lastAnalyzedWebsiteUrl: string; lastAnalyzedDomain: string } {
  const hints = readAnalyzeSuggestionFields(rec);
  const url =
    hints.suggestedCanonicalWebsiteUrl.trim() ||
    nextWebsiteUrl.trim() ||
    submittedWebsiteUrl.trim();
  const domain =
    normalizeDomainForComparison(url) ||
    normalizeDomainForComparison(hints.suggestedWebsiteDomain) ||
    normalizeDomainForComparison(submittedWebsiteUrl) ||
    "";
  return { lastAnalyzedWebsiteUrl: url, lastAnalyzedDomain: domain };
}

function mergeAnalyzeIntoIntake(
  prev: DesignIntakeState,
  rec: Record<string, unknown>,
  submittedWebsiteUrl: string,
  extractionSource: ExtractionSource,
  extractedMerge: ExtractedMerge,
): { next: DesignIntakeState; businessNameNote: string } {
  const websiteChanged = websiteChangedForSubmission(prev, submittedWebsiteUrl);
  const { suggestedBusinessName, suggestedCanonicalWebsiteUrl } =
    readAnalyzeSuggestionFields(rec);
  const trimmedName = suggestedBusinessName.trim();
  const nameOk = businessNameIsAutoFillable(prev.businessName);

  let nextName = prev.businessName;
  if (trimmedName) {
    if (websiteChanged || nameOk) {
      nextName = trimmedName;
    }
  }

  const urlOk = shouldApplyCanonicalWebsiteUrl(
    prev.websiteUrl,
    suggestedCanonicalWebsiteUrl,
  );
  const nextUrl = urlOk
    ? suggestedCanonicalWebsiteUrl.trim()
    : prev.websiteUrl;

  const logoCandidates = readLogoCandidatesFromAnalyzePayload(rec);
  const typographySignals = readTypographyFromAnalyzePayload(rec);
  const stillValidSelection =
    !websiteChanged &&
    logoCandidates.some((c) => c.url === prev.selectedLogoCandidateUrl);
  const selectedLogoCandidateUrl = stillValidSelection
    ? prev.selectedLogoCandidateUrl
    : "";

  let nextExtracted = prev.extracted;
  if (extractedMerge.mode === "replace") {
    nextExtracted = extractedMerge.extracted;
  } else if (extractedMerge.mode === "clear") {
    nextExtracted = emptyExtracted();
  }

  const tracking = resolveLastAnalyzedTracking(
    nextUrl,
    submittedWebsiteUrl,
    rec,
  );

  const next: DesignIntakeState = {
    ...prev,
    businessName: nextName,
    websiteUrl: nextUrl,
    extracted: nextExtracted,
    showExtracted: true,
    extractionSource,
    logoCandidates,
    selectedLogoCandidateUrl,
    typographySignals,
    lastAnalyzedWebsiteUrl: tracking.lastAnalyzedWebsiteUrl,
    lastAnalyzedDomain: tracking.lastAnalyzedDomain,
  };

  let businessNameNote = "";
  if (websiteChanged) {
    businessNameNote = NEW_WEBSITE_ANALYZE_NOTE;
  } else if (nameOk && trimmedName) {
    businessNameNote = BUSINESS_NAME_AUTO_UPDATE_NOTE;
  }

  return {
    next: { ...next, designBrief: computeDesignBriefText(next) },
    businessNameNote,
  };
}

/**
 * Pulls a small, sanitized list of logo candidates from the analyze API response
 * (`websiteFetch.logoCandidatesList`). Defensive: any malformed entry is dropped
 * rather than crashing the merge.
 */
export function readLogoCandidatesFromAnalyzePayload(
  rec: Record<string, unknown>,
): LogoCandidate[] {
  const wf = rec.websiteFetch;
  if (!wf || typeof wf !== "object" || Array.isArray(wf)) return [];
  const list = (wf as Record<string, unknown>).logoCandidatesList;
  if (!Array.isArray(list)) return [];

  const out: LogoCandidate[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const url = typeof o.url === "string" ? o.url.trim() : "";
    if (!url) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    const sourceRaw = typeof o.source === "string" ? o.source : "unknown";
    const allowed = new Set([
      "icon",
      "apple-touch-icon",
      "og:image",
      "img-logo",
      "header-image",
      "unknown",
    ]);
    const source = (allowed.has(sourceRaw) ? sourceRaw : "unknown") as LogoCandidate["source"];
    const alt =
      typeof o.alt === "string" && o.alt.trim() ? o.alt.trim().slice(0, 120) : undefined;
    const width =
      typeof o.width === "number" && Number.isFinite(o.width) && o.width > 0
        ? Math.round(o.width)
        : undefined;
    const height =
      typeof o.height === "number" && Number.isFinite(o.height) && o.height > 0
        ? Math.round(o.height)
        : undefined;
    const score =
      typeof o.score === "number" && Number.isFinite(o.score)
        ? Math.round(o.score)
        : undefined;
    const transparencyRaw =
      typeof o.transparency === "string" ? o.transparency : "";
    const transparency =
      transparencyRaw === "likely_transparent" ||
      transparencyRaw === "likely_opaque" ||
      transparencyRaw === "unknown"
        ? transparencyRaw
        : undefined;
    const reason =
      typeof o.reason === "string" && o.reason.trim()
        ? o.reason.trim().slice(0, 160)
        : undefined;
    out.push({
      url,
      source,
      ...(alt ? { alt } : {}),
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      ...(score !== undefined ? { score } : {}),
      ...(transparency ? { transparency } : {}),
      ...(reason ? { reason } : {}),
    });
    if (out.length >= 6) break;
  }
  out.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return out;
}

function typographyFromMeta(meta: WebsiteTypographyMeta): TypographySignals {
  return {
    fontFamilies: meta.fontFamilies ?? [],
    headingFontCandidates: meta.headingFontCandidates ?? [],
    bodyFontCandidates: meta.bodyFontCandidates ?? [],
    googleFontFamilies: meta.googleFontFamilies ?? [],
    styleGuess: meta.styleGuess ?? "unknown",
  };
}

/**
 * Typography signals from `websiteFetch.typography` (defensive parse).
 */
export function readTypographyFromAnalyzePayload(
  rec: Record<string, unknown>,
): TypographySignals | null {
  const wf = rec.websiteFetch;
  if (!wf || typeof wf !== "object" || Array.isArray(wf)) return null;
  const t = (wf as Record<string, unknown>).typography;
  if (!t || typeof t !== "object" || Array.isArray(t)) return null;
  const o = t as Record<string, unknown>;
  const styleRaw = typeof o.styleGuess === "string" ? o.styleGuess : "unknown";
  const styleGuess =
    styleRaw === "modern_sans" ||
    styleRaw === "classic_serif" ||
    styleRaw === "playful" ||
    styleRaw === "technical"
      ? styleRaw
      : "unknown";
  const strList = (key: string, max: number): string[] => {
    const arr = o[key];
    if (!Array.isArray(arr)) return [];
    const out: string[] = [];
    for (const item of arr) {
      if (typeof item !== "string") continue;
      const s = item.trim().slice(0, 48);
      if (s) out.push(s);
      if (out.length >= max) break;
    }
    return out;
  };
  const signals = sanitizeTypographySignals(
    typographyFromMeta({
      fontFamilies: strList("fontFamilies", 8),
      headingFontCandidates: strList("headingFontCandidates", 4),
      bodyFontCandidates: strList("bodyFontCandidates", 4),
      googleFontFamilies: strList("googleFontFamilies", 6),
      styleGuess,
      fontFamilyCount: 0,
      googleFontCount: 0,
    }),
  );
  if (
    signals.fontFamilies.length === 0 &&
    signals.googleFontFamilies.length === 0
  ) {
    return null;
  }
  return signals;
}

/**
 * Merges validated Claude `extracted` plus optional `suggestedBusinessName` / canonical URL hints.
 * When the submitted URL targets a new domain, replaces business identity and extracted rows.
 */
export function applyClaudeAnalyzeSuccessToIntake(
  prev: DesignIntakeState,
  extracted: DesignIntakeState["extracted"],
  rec: Record<string, unknown>,
  submittedWebsiteUrl: string,
): { next: DesignIntakeState; businessNameNote: string } {
  return mergeAnalyzeIntoIntake(
    prev,
    rec,
    submittedWebsiteUrl,
    "claude",
    { mode: "replace", extracted },
  );
}

/**
 * When Claude failed but static scrape succeeded — apply logos, typography, and
 * resolved business name / URL. Replaces extracted rows when the analyzed domain changed.
 */
export function applyPartialScrapeAnalyzeToIntake(
  prev: DesignIntakeState,
  rec: Record<string, unknown>,
  submittedWebsiteUrl: string,
): { next: DesignIntakeState; businessNameNote: string } {
  const extractedMerge: ExtractedMerge = websiteChangedForSubmission(
    prev,
    submittedWebsiteUrl,
  )
    ? { mode: "clear" }
    : { mode: "keep" };
  return mergeAnalyzeIntoIntake(
    prev,
    rec,
    submittedWebsiteUrl,
    "scraper_only",
    extractedMerge,
  );
}

/**
 * Last-resort mock extraction after analyze failure.
 */
export function applyMockAnalyzeFallbackToIntake(
  prev: DesignIntakeState,
  submittedWebsiteUrl: string,
): DesignIntakeState {
  const websiteChanged = websiteChangedForSubmission(prev, submittedWebsiteUrl);
  const next: DesignIntakeState = {
    ...prev,
    extracted: websiteChanged ? emptyExtracted() : buildMockExtracted(),
    showExtracted: true,
    extractionSource: "mock_fallback",
    logoCandidates: websiteChanged ? [] : prev.logoCandidates,
    selectedLogoCandidateUrl: websiteChanged ? "" : prev.selectedLogoCandidateUrl,
    typographySignals: websiteChanged ? null : prev.typographySignals,
    lastAnalyzedWebsiteUrl: submittedWebsiteUrl.trim(),
    lastAnalyzedDomain:
      normalizeDomainForComparison(submittedWebsiteUrl) ?? "",
  };
  return { ...next, designBrief: computeDesignBriefText(next) };
}
