import {
  analyzeStatusLineFromApiPayload,
  formatClaudeSuccessStatusLine,
} from "@/lib/analyzeWebsiteResponse";
import {
  applyClaudeAnalyzeSuccessToIntake,
  applyMockAnalyzeFallbackToIntake,
  applyPartialScrapeAnalyzeToIntake,
  readAnalyzeSuggestionFields,
} from "@/lib/analyzeWebsiteSuggestions";
import { isValidExtractedRowsPayload } from "@/lib/claudeExtractedContent";
import type { DesignIntakeState } from "@/lib/designIntakeState";

/** Normalize bare domains for analyze requests (e.g. `google.com` → `https://google.com`). */
export function normalizeWebsiteUrlForAnalyzeInput(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export type AnalyzeWebsiteClientOutcome = {
  statusLine: string;
  businessNameNote: string;
  next: DesignIntakeState;
};

function websiteFetchSucceeded(rec: Record<string, unknown>): boolean {
  const wf = rec.websiteFetch;
  if (!wf || typeof wf !== "object" || Array.isArray(wf)) return false;
  const status = (wf as Record<string, unknown>).status;
  return status === "success" || status === "partial";
}

function partialScrapeStatusLine(rec: Record<string, unknown>): string {
  const line = formatClaudeSuccessStatusLine(rec);
  if (rec.ok === true) return line;
  return line.replace(
    "Claude extraction used",
    "Scrape-only extraction used",
  );
}

/**
 * Maps `POST /api/analyze-website` JSON into intake state.
 * Uses Claude rows when valid; otherwise scrape-only hints when fetch succeeded; mock only as last resort.
 */
export function processAnalyzeWebsiteApiResponse(
  prev: DesignIntakeState,
  data: unknown,
  submittedWebsiteUrl = prev.websiteUrl,
): AnalyzeWebsiteClientOutcome {
  const submitted = normalizeWebsiteUrlForAnalyzeInput(submittedWebsiteUrl);
  const rec =
    data && typeof data === "object" ? (data as Record<string, unknown>) : null;

  if (!rec) {
    const next = applyMockAnalyzeFallbackToIntake(prev, submitted);
    return {
      statusLine: "Using mocked extraction for prototype.",
      businessNameNote: "",
      next,
    };
  }

  const extractedUnknown =
    "extracted" in rec ? (rec as { extracted: unknown }).extracted : undefined;
  const apiClaimsClaude = rec.ok === true && rec.source === "claude";

  if (apiClaimsClaude && isValidExtractedRowsPayload(extractedUnknown)) {
    const { next, businessNameNote } = applyClaudeAnalyzeSuccessToIntake(
      prev,
      extractedUnknown,
      rec,
      submitted,
    );
    return {
      statusLine: formatClaudeSuccessStatusLine(rec),
      businessNameNote,
      next,
    };
  }

  if (apiClaimsClaude) {
    const next = applyMockAnalyzeFallbackToIntake(prev, submitted);
    return {
      statusLine: "Using mocked extraction: invalid Claude response.",
      businessNameNote: "",
      next,
    };
  }

  if (websiteFetchSucceeded(rec)) {
    const hints = readAnalyzeSuggestionFields(rec);
    const hasLogos =
      Array.isArray(
        (rec.websiteFetch as Record<string, unknown> | undefined)
          ?.logoCandidatesList,
      ) &&
      ((rec.websiteFetch as Record<string, unknown>).logoCandidatesList as unknown[])
        .length > 0;
    const hasName = hints.suggestedBusinessName.trim().length > 0;
    if (hasLogos || hasName) {
      const { next, businessNameNote } = applyPartialScrapeAnalyzeToIntake(
        prev,
        rec,
        submitted,
      );
      return {
        statusLine: partialScrapeStatusLine(rec),
        businessNameNote,
        next,
      };
    }
  }

  const { line } = analyzeStatusLineFromApiPayload(rec);
  const next = applyMockAnalyzeFallbackToIntake(prev, submitted);
  return {
    statusLine: line,
    businessNameNote: "",
    next,
  };
}
