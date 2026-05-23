import type { DesignIntakeExtractSuccess } from "@/lib/designIntakeApiSchema";
import {
  BOOTH_COMPONENTS,
  computeDesignBriefText,
  DEFAULT_EXTRACTED_USE_FOR_DESIGN,
  emptyExtracted,
  OUTDOOR_COMPONENTS,
  type BoothComponent,
  type DesignIntakeState,
  type ExtractedKey,
  type ExtractedRow,
  type OutdoorComponent,
  type ProductCategory,
  type StylePreference,
} from "@/lib/designIntakeState";
import { sanitizeTypographySignals } from "@/lib/typographyFontCleanup";
import type { TypographySignals } from "@/lib/typographySignals";
import { normalizeDomainForComparison } from "@/lib/analyzeWebsiteDomain";

export type ExtractApiFormContext = {
  websiteUrl: string;
  productCategory: ProductCategory;
  components: string[];
  stylePreference: StylePreference;
  customerInstructions: string;
};

export type MapExtractApiOptions = {
  /** Preview-only logo selection; defaults to the top-ranked candidate. */
  selectedLogoUrl?: string;
};

function joinFieldList(items: string[] | undefined, separator = ", "): string {
  if (!items?.length) return "";
  return items.map((s) => s.trim()).filter(Boolean).join(separator);
}

function brandColorsText(colors: string[] | undefined): string {
  if (!colors?.length) return "";
  return colors
    .map((c) => {
      const t = c.trim();
      if (!t) return "";
      return t.startsWith("#") ? t : `#${t.replace(/^#/, "")}`;
    })
    .filter(Boolean)
    .join(" · ");
}

function typographyFromApiBrand(
  typography: DesignIntakeExtractSuccess["brand"]["typography"],
): TypographySignals | null {
  const signals = sanitizeTypographySignals({
    fontFamilies: typography.fontFamilies ?? [],
    headingFontCandidates: typography.headingFontCandidates ?? [],
    bodyFontCandidates: typography.bodyFontCandidates ?? [],
    googleFontFamilies: typography.googleFontFamilies ?? [],
    styleGuess: typography.styleGuess ?? "unknown",
  });
  if (
    signals.fontFamilies.length === 0 &&
    signals.googleFontFamilies.length === 0
  ) {
    return null;
  }
  return signals;
}

function extractionSourceFromMetadata(
  source: DesignIntakeExtractSuccess["metadata"]["source"],
): DesignIntakeState["extractionSource"] {
  switch (source) {
    case "scraper_plus_claude":
      return "claude";
    case "scraper_only":
      return "scraper_only";
    case "scraper_plus_mock":
      return "mock_fallback";
    default:
      return "scraper_only";
  }
}

function buildComponentFlags(
  category: ProductCategory,
  selected: string[],
): Pick<DesignIntakeState, "componentsOutdoor" | "componentsBooth"> {
  const outdoor = Object.fromEntries(
    OUTDOOR_COMPONENTS.map((name) => [name, selected.includes(name)]),
  ) as Record<OutdoorComponent, boolean>;
  const booth = Object.fromEntries(
    BOOTH_COMPONENTS.map((name) => [name, selected.includes(name)]),
  ) as Record<BoothComponent, boolean>;

  if (category === "Outdoor tent") {
    if (!OUTDOOR_COMPONENTS.some((c) => outdoor[c])) {
      outdoor["Canopy tent"] = true;
    }
    return { componentsOutdoor: outdoor, componentsBooth: booth };
  }

  if (!BOOTH_COMPONENTS.some((c) => booth[c])) {
    booth.Backdrop = true;
  }
  return { componentsOutdoor: outdoor, componentsBooth: booth };
}

function buildExtractedRows(
  response: DesignIntakeExtractSuccess,
  category: ProductCategory,
): Record<ExtractedKey, ExtractedRow> {
  const rows = emptyExtracted();
  const contact = response.content.contact;
  const topLogo = response.brand.logoCandidates[0];

  const values: Partial<Record<ExtractedKey, string>> = {
    brandColors: brandColorsText(response.brand.colors),
    phone: contact.phone?.trim() ?? "",
    email: contact.email?.trim() ?? "",
    address: contact.address?.trim() ?? "",
    social: joinFieldList(contact.social, " · "),
    services: joinFieldList(response.content.services),
    products: joinFieldList(response.content.products),
    logo: topLogo
      ? [topLogo.alt?.trim(), topLogo.source].filter(Boolean).join(" — ") ||
        topLogo.url
      : "",
  };

  (Object.keys(values) as ExtractedKey[]).forEach((key) => {
    const value = values[key]?.trim() ?? "";
    const useDefault = DEFAULT_EXTRACTED_USE_FOR_DESIGN[key];
    const useForDesign =
      value.length > 0 &&
      (key !== "address" || category === "Trade show booth") &&
      useDefault;
    rows[key] = { value, useForDesign };
  });

  return rows;
}

function resolveStylePreference(
  response: DesignIntakeExtractSuccess,
  form: ExtractApiFormContext,
): StylePreference {
  const raw =
    response.designIntake.stylePreference?.trim() || form.stylePreference;
  const allowed: StylePreference[] = [
    "Modern",
    "Conservative",
    "Traditional",
    "Playful",
  ];
  return allowed.includes(raw as StylePreference)
    ? (raw as StylePreference)
    : form.stylePreference;
}

function resolveProductCategory(
  response: DesignIntakeExtractSuccess,
  form: ExtractApiFormContext,
): ProductCategory {
  const raw =
    response.designIntake.productCategory?.trim() || form.productCategory;
  return raw === "Trade show booth" ? "Trade show booth" : "Outdoor tent";
}

function resolveComponents(
  response: DesignIntakeExtractSuccess,
  form: ExtractApiFormContext,
): string[] {
  const fromApi = response.designIntake.components?.filter(Boolean) ?? [];
  if (fromApi.length > 0) return fromApi;
  return form.components.length > 0 ? form.components : ["Canopy tent"];
}

/**
 * Map a successful `POST /api/design-intake/extract` payload into `DesignIntakeState`
 * for canvas preview only — does not mutate API behavior.
 */
export function mapExtractApiResponseToIntake(
  response: DesignIntakeExtractSuccess,
  form: ExtractApiFormContext,
  options: MapExtractApiOptions = {},
): DesignIntakeState {
  const category = resolveProductCategory(response, form);
  const components = resolveComponents(response, form);
  const style = resolveStylePreference(response, form);
  const logoCandidates = response.brand.logoCandidates ?? [];
  const selectedLogoCandidateUrl = options.selectedLogoUrl?.trim() ?? "";

  const websiteUrl =
    response.business.website?.trim() ||
    response.business.canonicalUrl?.trim() ||
    form.websiteUrl.trim();

  const base: DesignIntakeState = {
    websiteUrl,
    businessName: response.business.name?.trim() || "",
    category,
    style,
    instructions: form.customerInstructions.trim(),
    ...buildComponentFlags(category, components),
    extracted: buildExtractedRows(response, category),
    showExtracted: true,
    extractionSource: extractionSourceFromMetadata(response.metadata.source),
    logoCandidates,
    selectedLogoCandidateUrl,
    typographySignals: typographyFromApiBrand(response.brand.typography),
    designBrief: "",
    lastAnalyzedWebsiteUrl:
      response.business.canonicalUrl?.trim() ||
      response.business.website?.trim() ||
      websiteUrl,
    lastAnalyzedDomain:
      response.business.domain?.trim() ||
      normalizeDomainForComparison(websiteUrl) ||
      "",
  };

  return { ...base, designBrief: computeDesignBriefText(base) };
}
