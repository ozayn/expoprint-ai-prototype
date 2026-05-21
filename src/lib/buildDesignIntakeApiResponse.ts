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

function inferBusinessNameFromExtraction(
  extraction: WebsiteContentExtraction,
): string {
  const title = extraction.homepage.title.trim();
  if (title) {
    const part = title.split(/\s*[|\-–—]\s*/)[0]?.trim();
    if (part) return part.slice(0, 200);
  }
  const og = extraction.homepage.ogTitle.trim();
  if (og) return og.split(/\s*[|\-–—]\s*/)[0]?.trim().slice(0, 200) ?? "";
  return "";
}

function buildBusiness(
  request: DesignIntakeExtractRequest,
  claude: ClaudeWebsiteAnalyzeSuccess | null,
  websiteFetch: WebsiteFetchMeta,
  extraction: WebsiteContentExtraction,
): DesignIntakeApiBusiness {
  const canonical =
    claude?.suggestedCanonicalWebsiteUrl?.trim() ||
    (websiteFetch.status === "success" && websiteFetch.finalUrl
      ? websiteFetch.finalUrl.trim()
      : "");
  const website =
    canonical || request.websiteUrl.trim();
  let domain = claude?.suggestedWebsiteDomain?.trim() ?? "";
  if (!domain && website) {
    try {
      domain = new URL(
        /^https?:\/\//i.test(website) ? website : `https://${website}`,
      ).hostname.replace(/^www\./i, "");
    } catch {
      domain = "";
    }
  }
  const name =
    claude?.suggestedBusinessName?.trim() ||
    inferBusinessNameFromExtraction(extraction);
  return { name, website, domain, canonicalUrl: canonical || website };
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
  if (websiteFetch.status === "success") {
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
  warnings: string[],
  durationMs: number,
  source: DesignIntakeApiMetadata["source"],
): DesignIntakeApiMetadata {
  return {
    source,
    pagesInspected: result.websiteFetch.pagesFetched ?? 0,
    durationMs,
    websiteFetch: result.websiteFetch,
    claude: claudeStatusFromResult(result),
    warnings,
  };
}

function emptyRows(): Record<ExtractedKey, ExtractedRow> {
  const mock = buildMockExtracted();
  const out = { ...mock };
  (Object.keys(out) as ExtractedKey[]).forEach((k) => {
    out[k] = { value: "", useForDesign: false };
  });
  return out;
}

/**
 * Maps pipeline output to the integration API response contract.
 */
export function buildDesignIntakeExtractResponse(
  request: DesignIntakeExtractRequest,
  result: ClaudeWebsiteAnalyzeResult,
  durationMs: number,
): DesignIntakeExtractResponse {
  const warnings: string[] = [];
  const { websiteFetch, extraction } = result;

  if (websiteFetch.status === "failed") {
    warnings.push(`Website fetch failed (${websiteFetch.reason ?? "unknown"}).`);
  } else if (websiteFetch.status === "skipped") {
    warnings.push(`Website fetch skipped (${websiteFetch.reason ?? "unknown"}).`);
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

  if (result.ok) {
    const rows = result.extracted;
    const business = buildBusiness(request, result, websiteFetch, extraction);
    const brand: DesignIntakeApiBrand = {
      colors: parseBrandColors(rowValue(rows, "brandColors")),
      typography: typo,
      logoCandidates: logoList,
    };
    const content = buildContent(rows);
    const designIntake = buildDesignIntakeSection(
      request,
      rows,
      business,
      warnings,
      logoList.length,
    );
    const body: DesignIntakeExtractSuccess = {
      ok: true,
      business,
      brand,
      content,
      designIntake,
      metadata: buildMetadata(
        result,
        warnings,
        durationMs,
        "scraper_plus_claude",
      ),
    };
    return body;
  }

  const partialOk = scrapeHasUsefulPartial(websiteFetch, extraction);
  const rows =
    result.source === "missing_api_key" && partialOk
      ? emptyRows()
      : emptyRows();

  const business = buildBusiness(request, null, websiteFetch, extraction);
  const brand: DesignIntakeApiBrand = {
    colors: [],
    typography: typo,
    logoCandidates: logoList,
  };
  const content = buildContent(rows);
  const designIntake = buildDesignIntakeSection(
    request,
    rows,
    business,
    warnings,
    logoList.length,
  );

  if (partialOk) {
    const successBody: DesignIntakeExtractSuccess = {
      ok: true,
      business,
      brand,
      content,
      designIntake,
      metadata: buildMetadata(result, warnings, durationMs, "scraper_only"),
    };
    return successBody;
  }

  const failureBody: DesignIntakeExtractFailure = {
    ok: false,
    reason: result.reason ?? result.source,
    business,
    brand,
    content,
    designIntake,
    metadata: buildMetadata(result, warnings, durationMs, "scraper_only"),
  };
  return failureBody;
}
