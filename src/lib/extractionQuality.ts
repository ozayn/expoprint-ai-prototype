import type { LogoCandidate } from "@/lib/analyzeWebsiteResponse";
import { logoCandidatesAreFaviconOnly } from "@/lib/logoCandidateQuality";
import type { WebsiteFetchMeta } from "@/lib/analyzeWebsiteResponse";
import {
  isStaticFetchBlocked,
  SITE_BLOCKED_STATIC_FETCH_CODE,
} from "@/lib/websiteFetchBlocked";
import type {
  DesignIntakeApiContent,
  DesignIntakeApiMetadata,
  ExtractionQualityLevel,
  ExtractionQualitySummary,
} from "@/lib/designIntakeApiSchema";
import type { BusinessNameSource } from "@/lib/resolveBusinessName";
import type { ClaudeWebsiteAnalyzeResult } from "@/lib/server/claudeWebsiteAnalyze";

export const RELIABILITY_WARNING_CODES = {
  missingBusinessName: "missing_business_name",
  missingLogoCandidates: "missing_logo_candidates",
  missingServicesProducts: "missing_services_products",
  lowContentExtracted: "low_content_extracted",
  websiteFetchFailed: "website_fetch_failed",
  claudeFailedOrSkipped: "claude_failed_or_skipped",
  businessNameFromDomain: "business_name_inferred_from_domain",
  largeSitePartialExtraction: "large_site_partial_extraction",
  faviconOnlyLogo: "favicon_only_logo_candidate",
  siteBlockedStaticFetch: SITE_BLOCKED_STATIC_FETCH_CODE,
} as const;

export {
  CUSTOMER_PROVIDED_LOGO_ASSET,
  MANUAL_SERVICES_CONFIRM_ASSET,
  SITE_BLOCKED_STATIC_FETCH_CODE,
  SITE_BLOCKED_STATIC_FETCH_MESSAGE,
} from "@/lib/websiteFetchBlocked";
export { isStaticFetchBlocked } from "@/lib/websiteFetchBlocked";

function websiteFetchUsable(meta: WebsiteFetchMeta): boolean {
  return meta.status === "success" || meta.status === "partial";
}

function minLevel(
  ...levels: ExtractionQualityLevel[]
): ExtractionQualityLevel {
  if (levels.includes("low")) return "low";
  if (levels.includes("medium")) return "medium";
  return "high";
}

function businessNameQuality(
  name: string,
  source: BusinessNameSource,
): ExtractionQualityLevel {
  if (!name.trim()) return "low";
  if (source === "claude") return "high";
  if (source === "title") return "medium";
  if (source === "domain") return "low";
  return "low";
}

function logoQuality(candidates: LogoCandidate[]): ExtractionQualityLevel {
  if (candidates.length === 0) return "low";
  if (logoCandidatesAreFaviconOnly(candidates)) return "low";
  const top = candidates[0];
  if (top?.logoRole === "wordmark") return "high";
  if (top?.logoRole === "icon_mark") return "medium";
  const strongSources = new Set([
    "header-image",
    "img-logo",
    "og:image",
  ]);
  if (top && strongSources.has(top.source)) return "high";
  if (candidates.length >= 1) return "medium";
  return "low";
}

function servicesProductsQuality(content: DesignIntakeApiContent): ExtractionQualityLevel {
  const services = content.services.length;
  const products = content.products.length;
  if (services >= 2 || products >= 2 || (services >= 1 && products >= 1)) {
    return "high";
  }
  if (services >= 1 || products >= 1) return "medium";
  return "low";
}

function hasUsefulExtractedContent(
  websiteFetch: WebsiteFetchMeta | undefined,
  logoCandidates: LogoCandidate[],
  content: DesignIntakeApiContent,
): boolean {
  if (websiteFetch && websiteFetchUsable(websiteFetch)) {
    if (logoCandidates.length > 0) return true;
    if (content.services.length > 0 || content.products.length > 0) {
      return true;
    }
  }
  return false;
}

export function assessExtractionQuality(params: {
  businessName: string;
  businessNameSource: BusinessNameSource;
  logoCandidates: LogoCandidate[];
  content: DesignIntakeApiContent;
  websiteFetch?: WebsiteFetchMeta;
}): ExtractionQualitySummary {
  const businessName = businessNameQuality(
    params.businessName,
    params.businessNameSource,
  );
  const logo = logoQuality(params.logoCandidates);
  const servicesProducts = servicesProductsQuality(params.content);

  let overall = minLevel(businessName, logo, servicesProducts);
  if (
    params.websiteFetch &&
    isStaticFetchBlocked(params.websiteFetch) &&
    !hasUsefulExtractedContent(
      params.websiteFetch,
      params.logoCandidates,
      params.content,
    )
  ) {
    overall = "low";
  }

  return {
    businessName,
    logo,
    servicesProducts,
    overall,
  };
}

/**
 * Machine-readable reliability warning codes (additive; human lines may also appear).
 */
export function collectReliabilityWarningCodes(params: {
  result: ClaudeWebsiteAnalyzeResult;
  websiteFetch: WebsiteFetchMeta;
  businessName: string;
  businessNameSource: BusinessNameSource;
  logoCandidateCount: number;
  logoCandidates: LogoCandidate[];
  content: DesignIntakeApiContent;
}): string[] {
  const codes: string[] = [];
  const { result, websiteFetch, content } = params;

  if (isStaticFetchBlocked(websiteFetch)) {
    codes.push(RELIABILITY_WARNING_CODES.siteBlockedStaticFetch);
  }

  if (!websiteFetchUsable(websiteFetch)) {
    codes.push(RELIABILITY_WARNING_CODES.websiteFetchFailed);
  }

  if (
    websiteFetch.status === "partial" ||
    websiteFetch.reason === "body_truncated"
  ) {
    codes.push(RELIABILITY_WARNING_CODES.largeSitePartialExtraction);
  }

  if (!result.claudeAttempted || !result.ok) {
    codes.push(RELIABILITY_WARNING_CODES.claudeFailedOrSkipped);
  }

  if (!params.businessName.trim()) {
    codes.push(RELIABILITY_WARNING_CODES.missingBusinessName);
  } else if (params.businessNameSource === "domain") {
    codes.push(RELIABILITY_WARNING_CODES.businessNameFromDomain);
  }

  if (params.logoCandidateCount === 0) {
    codes.push(RELIABILITY_WARNING_CODES.missingLogoCandidates);
  } else if (logoCandidatesAreFaviconOnly(params.logoCandidates)) {
    codes.push(RELIABILITY_WARNING_CODES.faviconOnlyLogo);
  }

  if (content.services.length === 0 && content.products.length === 0) {
    codes.push(RELIABILITY_WARNING_CODES.missingServicesProducts);
  }

  const contactFilled =
    Boolean(content.contact.phone.trim()) ||
    Boolean(content.contact.email.trim()) ||
    content.contact.social.length > 0;

  if (
    content.services.length === 0 &&
    content.products.length === 0 &&
    !contactFilled &&
    params.logoCandidateCount === 0
  ) {
    codes.push(RELIABILITY_WARNING_CODES.lowContentExtracted);
  }

  return [...new Set(codes)];
}

/** Merge structured codes with existing human-readable warning lines. */
export function mergeWarnings(
  humanWarnings: string[],
  codes: string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of [...humanWarnings, ...codes]) {
    const key = w.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out.slice(0, 16);
}

export function attachQualityToMetadata(
  metadata: DesignIntakeApiMetadata,
  quality: ExtractionQualitySummary,
): DesignIntakeApiMetadata {
  return { ...metadata, quality };
}
