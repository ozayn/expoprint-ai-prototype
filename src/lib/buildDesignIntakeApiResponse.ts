import type { ExtractedKey, ExtractedRow } from "@/lib/designIntakeState";
import { buildMockExtracted } from "@/lib/designIntakeState";
import type {
  DesignIntakeApiBrand,
  DesignIntakeApiBusiness,
  DesignIntakeApiContent,
  DesignIntakeApiDesignIntake,
  DesignIntakeApiMetadata,
  DesignIntakeApiTypography,
  DesignIntakeExtractFailure,
  DesignIntakeExtractRequest,
  DesignIntakeExtractResponse,
  DesignIntakeExtractSuccess,
} from "@/lib/designIntakeApiSchema";
import type { LogoCandidate } from "@/lib/analyzeWebsiteResponse";
import type { WebsiteFetchMeta } from "@/lib/analyzeWebsiteResponse";
import {
  assessExtractionQuality,
  attachQualityToMetadata,
  collectReliabilityWarningCodes,
  mergeWarnings,
} from "@/lib/extractionQuality";
import { resolveBusinessName } from "@/lib/resolveBusinessName";
import { sanitizeTypographySignals } from "@/lib/typographyFontCleanup";
import { emptyTypographySignals } from "@/lib/typographySignals";
import type {
  ClaudeWebsiteAnalyzeResult,
  ClaudeWebsiteAnalyzeSuccess,
} from "@/lib/server/claudeWebsiteAnalyze";
import type { WebsiteContentExtraction } from "@/lib/server/extractWebsiteContent";

const HEX_COLOR_RE = /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi;

function splitListField(raw: string, max = 8): string[] {
  const t = raw.trim();
  if (!t) return [];
  const parts = t
    .split(/\s*[,;·•|]\s*/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p.slice(0, 120));
    if (out.length >= max) break;
  }
  return out;
}

function parseBrandColors(raw: string): string[] {
  const matches = raw.match(HEX_COLOR_RE) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of matches) {
    const norm = h.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(h);
    if (out.length >= 8) break;
  }
  return out;
}

function typographyFromExtraction(
  extraction: WebsiteContentExtraction,
): DesignIntakeApiTypography {
  const t = sanitizeTypographySignals(
    extraction.typography ?? emptyTypographySignals(),
  );
  return {
    fontFamilies: t.fontFamilies.slice(0, 8),
    headingFontCandidates: t.headingFontCandidates.slice(0, 4),
    bodyFontCandidates: t.bodyFontCandidates.slice(0, 4),
    googleFontFamilies: t.googleFontFamilies.slice(0, 6),
    styleGuess: t.styleGuess,
  };
}

function logoCandidatesFromFetch(meta: WebsiteFetchMeta): LogoCandidate[] {
  const list = meta.logoCandidatesList;
  if (!Array.isArray(list)) return [];
  return list.slice(0, 6);
}

function rowValue(rows: Record<ExtractedKey, ExtractedRow>, key: ExtractedKey): string {
  return rows[key]?.value?.trim() ?? "";
}

function resolveDomain(
  request: DesignIntakeExtractRequest,
  claude: ClaudeWebsiteAnalyzeSuccess | null,
  websiteFetch: WebsiteFetchMeta,
): string {
  let domain = claude?.suggestedWebsiteDomain?.trim() ?? "";
  const canonical =
    claude?.suggestedCanonicalWebsiteUrl?.trim() ||
    ((websiteFetch.status === "success" || websiteFetch.status === "partial") &&
    websiteFetch.finalUrl
      ? websiteFetch.finalUrl.trim()
      : "");
  const website = canonical || request.websiteUrl.trim();
  if (!domain && website) {
    try {
      domain = new URL(
        /^https?:\/\//i.test(website) ? website : `https://${website}`,
      ).hostname.replace(/^www\./i, "");
    } catch {
      domain = "";
    }
  }
  return domain;
}

function buildBusiness(
  request: DesignIntakeExtractRequest,
  claude: ClaudeWebsiteAnalyzeSuccess | null,
  websiteFetch: WebsiteFetchMeta,
  extraction: WebsiteContentExtraction,
): DesignIntakeApiBusiness {
  const canonical =
    claude?.suggestedCanonicalWebsiteUrl?.trim() ||
    ((websiteFetch.status === "success" || websiteFetch.status === "partial") &&
    websiteFetch.finalUrl
      ? websiteFetch.finalUrl.trim()
      : "");
  const website = canonical || request.websiteUrl.trim();
  const domain = resolveDomain(request, claude, websiteFetch);
  const resolved = resolveBusinessName({
    claudeSuggestedName: claude?.suggestedBusinessName,
    domain,
    extraction,
  });

  return {
    name: resolved.name,
    website,
    domain,
    canonicalUrl: canonical || website,
  };
}

function buildContent(rows: Record<ExtractedKey, ExtractedRow>): DesignIntakeApiContent {
  const socialRaw = rowValue(rows, "social");
  return {
    services: splitListField(rowValue(rows, "services")),
    products: splitListField(rowValue(rows, "products")),
    contact: {
      phone: rowValue(rows, "phone"),
      email: rowValue(rows, "email"),
      address: rowValue(rows, "address"),
      social: splitListField(socialRaw, 6),
    },
  };
}

function buildDesignIntakeSection(
  request: DesignIntakeExtractRequest,
  rows: Record<ExtractedKey, ExtractedRow>,
  business: DesignIntakeApiBusiness,
  warnings: string[],
  logoCandidateCount: number,
  businessNameSourceNote?: string,
): DesignIntakeApiDesignIntake {
  const services = rowValue(rows, "services");
  const products = rowValue(rows, "products");
  const comps = request.components ?? [];
  let supporting = services || products;
  if (!supporting && comps.length > 0) {
    supporting = comps.join(" · ");
  }

  const missingAssets: string[] = [];
  if (logoCandidateCount === 0) {
    missingAssets.push("Verified production logo file");
  }
  if (parseBrandColors(rowValue(rows, "brandColors")).length === 0) {
    missingAssets.push("Brand color palette confirmation");
  }
  if (missingAssets.length === 0) {
    missingAssets.push("Production-quality logo upload still recommended");
  }

  const confidenceNotes: string[] = [
    "Prototype extraction — not print-ready artwork.",
    "Logo candidates require human confirmation before production.",
  ];
  if (businessNameSourceNote) {
    confidenceNotes.push(businessNameSourceNote);
  }
  if (warnings.length) {
    confidenceNotes.push(...warnings.slice(0, 6));
  }

  return {
    productCategory: request.productCategory ?? "",
    components: comps,
    stylePreference: request.stylePreference ?? "",
    recommendedHeadline: business.name || "",
    recommendedSupportingText: supporting.slice(0, 280),
    missingAssets: [...new Set(missingAssets)].slice(0, 8),
    confidenceNotes: confidenceNotes.slice(0, 10),
    needsHumanReview: true,
  };
}

function scrapeHasUsefulPartial(
  websiteFetch: WebsiteFetchMeta,
  extraction: WebsiteContentExtraction,
): boolean {
  if (websiteFetch.status === "success" || websiteFetch.status === "partial") {
    const logos = logoCandidatesFromFetch(websiteFetch).length;
    const typo =
      extraction.typography.fontFamilies.length > 0 ||
      extraction.typography.googleFontFamilies.length > 0;
    if (logos > 0 || typo) return true;
    if ((websiteFetch.pagesFetched ?? 0) >= 1) return true;
  }
  return false;
}

function claudeStatusFromResult(result: ClaudeWebsiteAnalyzeResult): {
  attempted: boolean;
  model: string;
  status: string;
  reason?: string;
} {
  if (!result.claudeAttempted) {
    return {
      attempted: false,
      model: result.model,
      status: result.source,
      reason: result.reason,
    };
  }
  if (result.ok) {
    return { attempted: true, model: result.model, status: "success" };
  }
  return {
    attempted: true,
    model: result.model,
    status: result.source,
    reason: result.reason,
  };
}

function buildMetadata(
  result: ClaudeWebsiteAnalyzeResult,
  humanWarnings: string[],
  codes: string[],
  durationMs: number,
  source: DesignIntakeApiMetadata["source"],
  quality: ReturnType<typeof assessExtractionQuality>,
): DesignIntakeApiMetadata {
  return attachQualityToMetadata(
    {
      source,
      pagesInspected: result.websiteFetch.pagesFetched ?? 0,
      durationMs,
      websiteFetch: result.websiteFetch,
      claude: claudeStatusFromResult(result),
      warnings: mergeWarnings(humanWarnings, codes),
    },
    quality,
  );
}

function emptyRows(): Record<ExtractedKey, ExtractedRow> {
  const mock = buildMockExtracted();
  const out = { ...mock };
  (Object.keys(out) as ExtractedKey[]).forEach((k) => {
    out[k] = { value: "", useForDesign: false };
  });
  return out;
}

function humanReadableWarnings(result: ClaudeWebsiteAnalyzeResult): string[] {
  const warnings: string[] = [];
  const { websiteFetch, extraction } = result;

  if (websiteFetch.status === "failed") {
    warnings.push(`Website fetch failed (${websiteFetch.reason ?? "unknown"}).`);
  } else if (websiteFetch.status === "skipped") {
    warnings.push(`Website fetch skipped (${websiteFetch.reason ?? "unknown"}).`);
  } else if (
    websiteFetch.status === "partial" ||
    websiteFetch.reason === "body_truncated"
  ) {
    warnings.push(
      "Homepage HTML exceeded size cap; partial extraction from truncated page (title, meta, logos, links).",
    );
  }

  if (!result.claudeAttempted) {
    warnings.push("Claude extraction not attempted (missing API key).");
  } else if (!result.ok) {
    warnings.push(
      `Claude extraction failed (${result.reason ?? result.source}).`,
    );
  }

  const logoList = logoCandidatesFromFetch(websiteFetch);
  if (logoList.length === 0) {
    warnings.push("No logo image candidates found in static HTML.");
  }

  const typo = typographyFromExtraction(extraction);
  if (
    typo.fontFamilies.length === 0 &&
    typo.googleFontFamilies.length === 0
  ) {
    warnings.push("No typography signals detected from static HTML/CSS.");
  }

  return warnings;
}

function assembleResponseParts(
  request: DesignIntakeExtractRequest,
  result: ClaudeWebsiteAnalyzeResult,
  claude: ClaudeWebsiteAnalyzeSuccess | null,
  rows: Record<ExtractedKey, ExtractedRow>,
  durationMs: number,
  source: DesignIntakeApiMetadata["source"],
): DesignIntakeExtractSuccess | DesignIntakeExtractFailure {
  const humanWarnings = humanReadableWarnings(result);
  const { websiteFetch, extraction } = result;
  const logoList = logoCandidatesFromFetch(websiteFetch);
  const business = buildBusiness(request, claude, websiteFetch, extraction);
  const domain = business.domain;
  const resolved = resolveBusinessName({
    claudeSuggestedName: claude?.suggestedBusinessName,
    domain,
    extraction,
  });

  const brand: DesignIntakeApiBrand = {
    colors: parseBrandColors(rowValue(rows, "brandColors")),
    typography: typographyFromExtraction(extraction),
    logoCandidates: logoList,
  };
  const content = buildContent(rows);

  const businessNameSourceNote = resolved.inferredFromDomain
    ? "Business name inferred from domain (cautious fallback)."
    : undefined;

  const codes = collectReliabilityWarningCodes({
    result,
    websiteFetch,
    businessName: business.name,
    businessNameSource: resolved.source,
    logoCandidateCount: logoList.length,
    content,
  });

  const quality = assessExtractionQuality({
    businessName: business.name,
    businessNameSource: resolved.source,
    logoCandidates: logoList,
    content,
  });

  const designIntake = buildDesignIntakeSection(
    request,
    rows,
    business,
    humanWarnings,
    logoList.length,
    businessNameSourceNote,
  );

  const metadata = buildMetadata(
    result,
    humanWarnings,
    codes,
    durationMs,
    source,
    quality,
  );

  return {
    ok: true as const,
    business,
    brand,
    content,
    designIntake,
    metadata,
  };
}

/**
 * Maps `runClaudeWebsiteAnalyze` output to the integration API contract only.
 * Does not run scrape or Claude — used exclusively by `POST /api/design-intake/extract`.
 */
export function buildDesignIntakeExtractResponse(
  request: DesignIntakeExtractRequest,
  result: ClaudeWebsiteAnalyzeResult,
  durationMs: number,
): DesignIntakeExtractResponse {
  if (result.ok) {
    const body = assembleResponseParts(
      request,
      result,
      result,
      result.extracted,
      durationMs,
      "scraper_plus_claude",
    );
    return body;
  }

  const partialOk = scrapeHasUsefulPartial(result.websiteFetch, result.extraction);
  const rows = emptyRows();

  if (partialOk) {
    return assembleResponseParts(
      request,
      result,
      null,
      rows,
      durationMs,
      "scraper_only",
    );
  }

  const partial = assembleResponseParts(
    request,
    result,
    null,
    rows,
    durationMs,
    "scraper_only",
  );

  const failureBody: DesignIntakeExtractFailure = {
    ok: false,
    reason: result.reason ?? result.source,
    business: partial.business,
    brand: partial.brand,
    content: partial.content,
    designIntake: partial.designIntake,
    metadata: partial.metadata,
  };
  return failureBody;
}
