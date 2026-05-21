import {
  analyzeStatusLineFromApiPayload,
  formatClaudeSuccessStatusLine,
} from "@/lib/analyzeWebsiteResponse";
import {
  applyClaudeAnalyzeSuccessToIntake,
  applyPartialScrapeAnalyzeToIntake,
  readAnalyzeSuggestionFields,
} from "@/lib/analyzeWebsiteSuggestions";
import { isValidExtractedRowsPayload } from "@/lib/claudeExtractedContent";
import {
  buildMockExtracted,
  computeDesignBriefText,
  type DesignIntakeState,
} from "@/lib/designIntakeState";

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
  const base = analyzeStatusLineFromApiPayload(rec).line;
  const reason = typeof rec.reason === "string" ? rec.reason : "";
  const source = typeof rec.source === "string" ? rec.source : "";
  const detail =
    reason && reason !== source ? `${source}: ${reason}` : source || reason;
  if (base.includes("Claude extraction used")) {
    return base.replace(
      "Claude extraction used",
      `Scrape data used (Claude unavailable${detail ? `: ${detail}` : ""})`,
    );
  }
  return `Scrape data used · ${detail || "Claude unavailable"}.`;
}

/**
 * Maps `POST /api/analyze-website` JSON into intake state.
 * Uses Claude rows when valid; otherwise scrape-only hints when fetch succeeded; mock only as last resort.
 */
export function processAnalyzeWebsiteApiResponse(
  prev: DesignIntakeState,
  data: unknown,
): AnalyzeWebsiteClientOutcome {
  const rec =
    data && typeof data === "object" ? (data as Record<string, unknown>) : null;

  if (!rec) {
    const next = applyMockFallback(prev);
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
    );
    return {
      statusLine: formatClaudeSuccessStatusLine(rec),
      businessNameNote,
      next,
    };
  }

  if (apiClaimsClaude) {
    const next = applyMockFallback(prev);
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
      );
      return {
        statusLine: partialScrapeStatusLine(rec),
        businessNameNote,
        next,
      };
    }
  }

  const { line } = analyzeStatusLineFromApiPayload(rec);
  const next = applyMockFallback(prev);
  return {
    statusLine: line,
    businessNameNote: "",
    next,
  };
}

function applyMockFallback(prev: DesignIntakeState): DesignIntakeState {
  const next: DesignIntakeState = {
    ...prev,
    extracted: buildMockExtracted(),
    showExtracted: true,
    extractionSource: "mock_fallback",
    logoCandidates: [],
    selectedLogoCandidateUrl: "",
    typographySignals: null,
  };
  return { ...next, designBrief: computeDesignBriefText(next) };
}
