import type { ExtractedKey, ExtractedRow } from "./designIntakeState";
import type { WebsiteTypographyMeta } from "./typographySignals";

/**
 * Safe, non-secret fields returned by `POST /api/analyze-website`.
 * `mock_fallback` is client-only (UI); the API never returns it.
 */
export type AnalyzeWebsiteApiSource =
  | "claude"
  | "missing_api_key"
  | "api_error"
  | "invalid_json";

/**
 * Where a logo candidate URL was discovered. `unknown` is reserved for
 * forward-compatibility with future sources.
 */
export type LogoCandidateSource =
  | "icon"
  | "apple-touch-icon"
  | "og:image"
  | "img-logo"
  | "header-image"
  | "unknown";

/**
 * Safe metadata about a single discovered logo candidate. URLs are absolute and
 * same-protocol-as-fetch; not validated as actual images on the server.
 */
export type LogoCandidateTransparency =
  | "likely_transparent"
  | "likely_opaque"
  | "unknown";

/** Likely design role of a discovered logo asset (optional on API responses). */
export type LogoRole =
  | "wordmark"
  | "icon_mark"
  | "social_preview"
  | "marketing_image"
  | "fallback_icon"
  | "unknown";

export type LogoCandidate = {
  url: string;
  source: LogoCandidateSource;
  alt?: string;
  width?: number;
  height?: number;
  /** Higher = better for design placement (server-ranked). */
  score?: number;
  transparency?: LogoCandidateTransparency;
  /** Likely role: wordmark, compact icon mark, social card art, etc. */
  logoRole?: LogoRole;
  /** Upstream image probe (same rules as `/api/proxy-image`); optional on API/UI lists. */
  previewFetch?: {
    accepted: boolean;
    contentType?: string;
    reason?: string;
  };
  /** Short human-readable ranking note for UI/debug. */
  reason?: string;
};

/**
 * Safe subset of website fetch outcome for API / UI (no raw HTML or full page text).
 * Multi-page fields are optional for backward compatibility with older clients.
 */
export type WebsiteFetchMeta = {
  status: "success" | "partial" | "skipped" | "failed";
  reason?: string;
  finalUrl?: string;
  titleFound?: boolean;
  /** Approximate visible characters passed to Claude across homepage + extras (capped). */
  textChars?: number;
  /** Total logo URL candidates collected across inspected pages (deduped). */
  logoCandidates?: number;
  /** Up to ~6 detailed logo candidates exposed to the client UI (no raw HTML). */
  logoCandidatesList?: LogoCandidate[];
  contactLinks?: number;
  /** Homepage plus each extra URL tried (same-origin candidates only). */
  pagesAttempted?: number;
  /** Successful HTTP parses: 1 for homepage-only, up to 4 with three extras. */
  pagesFetched?: number;
  /** Extra-page GET failures (homepage failure uses status failed, not counted here). */
  pagesFailed?: number;
  /** Heuristic buckets seen on fetched paths, e.g. about / services / contact. */
  pageTypesFound?: string[];
  /** Machine-readable scrape-depth / crawl diagnostic codes. */
  scrapeDepthDiagnostics?: string[];
  /** Social profile URLs discovered before brand-profile filter. */
  socialLinksDiscovered?: string[];
  /** Counts from JSON-LD / structured HTML contact signals. */
  structuredEmailsFound?: number;
  structuredPhonesFound?: number;
  structuredAddressesFound?: number;
  /** Typography/font signals (names only — no raw CSS). */
  typography?: WebsiteTypographyMeta;
};

export type AnalyzeWebsiteApiSuccess = {
  ok: true;
  source: "claude";
  extracted: Record<ExtractedKey, ExtractedRow>;
  /** Claude + server hints; empty strings when unknown. Not returned on failures. */
  suggestedBusinessName: string;
  suggestedWebsiteDomain: string;
  /** Canonical https URL from redirect final URL or normalized user input; for display only. */
  suggestedCanonicalWebsiteUrl: string;
  claudeAttempted: true;
  durationMs: number;
  model: string;
  websiteFetch: WebsiteFetchMeta;
};

export type AnalyzeWebsiteApiFailure = {
  ok: false;
  source: AnalyzeWebsiteApiSource;
  reason?: string;
  claudeAttempted: boolean;
  durationMs: number;
  /** Resolved model id from env (no secrets). */
  model?: string;
  websiteFetch?: WebsiteFetchMeta;
  /** Debug hints (title/domain fallbacks when Claude name is empty). */
  suggestedBusinessName?: string;
  suggestedWebsiteDomain?: string;
  suggestedCanonicalWebsiteUrl?: string;
};

export type AnalyzeWebsiteApiResponse =
  | AnalyzeWebsiteApiSuccess
  | AnalyzeWebsiteApiFailure;

/** User-facing line after Analyze Website (no secrets). */
export function analyzeStatusLineFromApiPayload(data: unknown): {
  useClaudeExtracted: boolean;
  line: string;
} {
  if (!data || typeof data !== "object") {
    return {
      useClaudeExtracted: false,
      line: "Using mocked extraction for prototype.",
    };
  }
  const d = data as Record<string, unknown>;
  const ok = d.ok === true;
  const source = typeof d.source === "string" ? d.source : "";

  if (ok && source === "claude") {
    return {
      useClaudeExtracted: true,
      line: formatClaudeSuccessStatusLine(d),
    };
  }

  if (source === "missing_api_key") {
    return {
      useClaudeExtracted: false,
      line: "Using mocked extraction: missing API key.",
    };
  }
  if (source === "api_error") {
    return {
      useClaudeExtracted: false,
      line: "Using mocked extraction: API error.",
    };
  }
  if (source === "invalid_json") {
    const reason = typeof d.reason === "string" ? d.reason : "";
    if (reason === "invalid_json_body") {
      return {
        useClaudeExtracted: false,
        line: "Using mocked extraction for prototype.",
      };
    }
    return {
      useClaudeExtracted: false,
      line: "Using mocked extraction: invalid Claude response.",
    };
  }

  return {
    useClaudeExtracted: false,
    line: "Using mocked extraction for prototype.",
  };
}

/** Status line when Claude rows succeeded (includes homepage fetch hint). */
export function formatClaudeSuccessStatusLine(data: Record<string, unknown>): string {
  const wf = data.websiteFetch;
  if (!wf || typeof wf !== "object" || Array.isArray(wf)) {
    return "Claude extraction used.";
  }
  const w = wf as Record<string, unknown>;
  const status = typeof w.status === "string" ? w.status : "";
  if (status === "success" || status === "partial") {
    const truncated =
      typeof w.reason === "string" && w.reason === "body_truncated";
    const pagesFetched =
      typeof w.pagesFetched === "number" && Number.isFinite(w.pagesFetched)
        ? w.pagesFetched
        : 1;
    const logoCount = Array.isArray(w.logoCandidatesList)
      ? w.logoCandidatesList.length
      : 0;
    const logoHint = logoCount > 0 ? ` · ${logoCount} logo candidate${logoCount === 1 ? "" : "s"}` : "";
    const truncHint = truncated
      ? " · large page partially inspected"
      : "";
    if (pagesFetched >= 2) {
      return `Claude extraction used · ${pagesFetched} pages inspected${logoHint}${truncHint}.`;
    }
    return `Claude extraction used · Website content fetched${logoHint}${truncHint}.`;
  }
  if (status === "failed") {
    return "Claude extraction used · Website fetch failed.";
  }
  if (status === "skipped") {
    const reason = typeof w.reason === "string" ? w.reason : "";
    if (reason === "empty_url" || reason === "invalid_url") {
      return "Claude extraction used · Website skipped (no valid URL).";
    }
    return "Claude extraction used.";
  }
  return "Claude extraction used.";
}
