import type { DesignIntakeState } from "./designIntakeState";
import {
  computeDesignBriefText,
  DEFAULT_DEMO_BUSINESS_NAME,
} from "./designIntakeState";

/** Intake merge helpers after `POST /api/analyze-website` — used by `/` and `/demo`. */

/** True when Analyze may replace the main business name field with Claude output. */
export function businessNameIsAutoFillable(current: string): boolean {
  const t = current.trim();
  return t.length === 0 || t === DEFAULT_DEMO_BUSINESS_NAME;
}

function normalizedHostKey(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withScheme).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
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
  const hCur = normalizedHostKey(cur);
  const hSug = normalizedHostKey(sug);
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

/**
 * Merges validated Claude `extracted` plus optional `suggestedBusinessName` / canonical URL hints.
 * `businessName` is updated only when {@link businessNameIsAutoFillable} (blank or {@link DEFAULT_DEMO_BUSINESS_NAME}).
 */
export function applyClaudeAnalyzeSuccessToIntake(
  prev: DesignIntakeState,
  extracted: DesignIntakeState["extracted"],
  rec: Record<string, unknown>,
): { next: DesignIntakeState; businessNameNote: string } {
  const { suggestedBusinessName, suggestedCanonicalWebsiteUrl } =
    readAnalyzeSuggestionFields(rec);
  const trimmedName = suggestedBusinessName.trim();
  const nameOk = businessNameIsAutoFillable(prev.businessName);
  const nextName =
    nameOk && trimmedName ? trimmedName : prev.businessName;
  const urlOk = shouldApplyCanonicalWebsiteUrl(
    prev.websiteUrl,
    suggestedCanonicalWebsiteUrl,
  );
  const nextUrl = urlOk
    ? suggestedCanonicalWebsiteUrl.trim()
    : prev.websiteUrl;

  const next: DesignIntakeState = {
    ...prev,
    businessName: nextName,
    websiteUrl: nextUrl,
    extracted,
    showExtracted: true,
    extractionSource: "claude",
  };
  return {
    next: { ...next, designBrief: computeDesignBriefText(next) },
    businessNameNote:
      nameOk && trimmedName ? BUSINESS_NAME_AUTO_UPDATE_NOTE : "",
  };
}
