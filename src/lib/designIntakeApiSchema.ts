import type { LogoCandidate } from "@/lib/analyzeWebsiteResponse";
import type { WebsiteFetchMeta } from "@/lib/analyzeWebsiteResponse";
import type { TypographyStyleGuess } from "@/lib/typographySignals";

/** POST /api/design-intake/extract request body (integration contract v1). */
export type DesignIntakeExtractRequest = {
  websiteUrl: string;
  productCategory?: string;
  components?: string[];
  stylePreference?: string;
  customerInstructions?: string;
};

export type DesignIntakeApiTypography = {
  fontFamilies: string[];
  headingFontCandidates: string[];
  bodyFontCandidates: string[];
  googleFontFamilies: string[];
  styleGuess: TypographyStyleGuess;
};

export type DesignIntakeApiBusiness = {
  name: string;
  website: string;
  domain: string;
  canonicalUrl: string;
};

export type DesignIntakeApiBrand = {
  colors: string[];
  typography: DesignIntakeApiTypography;
  logoCandidates: LogoCandidate[];
  /** Where brand.colors originated (additive — optional on older responses). */
  paletteSource?: "extraction" | "logo";
  paletteConfidence?: "high" | "medium" | "low" | "unknown";
};

export type DesignIntakeApiContact = {
  phone: string;
  email: string;
  address: string;
  social: string[];
};

export type DesignIntakeApiContent = {
  services: string[];
  products: string[];
  contact: DesignIntakeApiContact;
};

export type DesignIntakeApiDesignIntake = {
  productCategory: string;
  components: string[];
  stylePreference: string;
  recommendedHeadline: string;
  recommendedSupportingText: string;
  missingAssets: string[];
  confidenceNotes: string[];
  needsHumanReview: boolean;
};

export type DesignIntakeApiClaudeMeta = {
  attempted: boolean;
  model: string;
  status: string;
  reason?: string;
};

export type ExtractionQualityLevel = "high" | "medium" | "low";

export type ExtractionQualitySummary = {
  businessName: ExtractionQualityLevel;
  logo: ExtractionQualityLevel;
  servicesProducts: ExtractionQualityLevel;
  overall: ExtractionQualityLevel;
};

export type DesignIntakeApiMetadata = {
  source: "scraper_plus_claude" | "scraper_only" | "scraper_plus_mock";
  pagesInspected: number;
  durationMs: number;
  websiteFetch: WebsiteFetchMeta;
  claude: DesignIntakeApiClaudeMeta;
  warnings: string[];
  /** Prototype quality signals for integration/debugging (additive field). */
  quality?: ExtractionQualitySummary;
};

export type DesignIntakeExtractSuccess = {
  ok: true;
  business: DesignIntakeApiBusiness;
  brand: DesignIntakeApiBrand;
  content: DesignIntakeApiContent;
  designIntake: DesignIntakeApiDesignIntake;
  metadata: DesignIntakeApiMetadata;
};

export type DesignIntakeExtractFailure = {
  ok: false;
  reason: string;
  business?: DesignIntakeApiBusiness;
  brand?: DesignIntakeApiBrand;
  content?: DesignIntakeApiContent;
  designIntake?: DesignIntakeApiDesignIntake;
  metadata: DesignIntakeApiMetadata;
};

export type DesignIntakeExtractResponse =
  | DesignIntakeExtractSuccess
  | DesignIntakeExtractFailure;

const MAX_COMPONENTS = 12;
const MAX_INSTRUCTIONS_CHARS = 4000;

function asTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    const t = item.replace(/\s+/g, " ").trim();
    if (!t) continue;
    out.push(t.slice(0, 120));
    if (out.length >= max) break;
  }
  return out;
}

export type ParseDesignIntakeRequestResult =
  | { ok: true; body: DesignIntakeExtractRequest }
  | { ok: false; reason: string };

/**
 * Validates and normalizes the integration API request body.
 */
export function parseDesignIntakeExtractRequest(
  raw: unknown,
): ParseDesignIntakeRequestResult {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "invalid_json_body" };
  }
  const o = raw as Record<string, unknown>;
  const websiteUrl = asTrimmedString(o.websiteUrl);
  if (!websiteUrl) {
    return { ok: false, reason: "websiteUrl_required" };
  }
  const instructions = asTrimmedString(o.customerInstructions);
  return {
    ok: true,
    body: {
      websiteUrl,
      productCategory: asTrimmedString(o.productCategory),
      components: asStringArray(o.components, MAX_COMPONENTS),
      stylePreference: asTrimmedString(o.stylePreference),
      customerInstructions:
        instructions.length > MAX_INSTRUCTIONS_CHARS
          ? instructions.slice(0, MAX_INSTRUCTIONS_CHARS)
          : instructions,
    },
  };
}
