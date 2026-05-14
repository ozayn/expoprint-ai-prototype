import type { ExtractedKey, ExtractedRow } from "./designIntakeState";

/**
 * Safe, non-secret fields returned by `POST /api/analyze-website`.
 * `mock_fallback` is client-only (UI); the API never returns it.
 */
export type AnalyzeWebsiteApiSource =
  | "claude"
  | "missing_api_key"
  | "api_error"
  | "invalid_json";

/** Safe subset of homepage fetch outcome for API / UI (no raw HTML or full text). */
export type WebsiteFetchMeta = {
  status: "success" | "skipped" | "failed";
  reason?: string;
  finalUrl?: string;
  titleFound?: boolean;
  textChars?: number;
  logoCandidates?: number;
  contactLinks?: number;
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
  if (status === "success") {
    return "Claude extraction used · Website content fetched.";
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
