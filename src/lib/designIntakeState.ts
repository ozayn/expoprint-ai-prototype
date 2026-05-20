import type { LogoCandidate } from "@/lib/analyzeWebsiteResponse";
import type { TypographySignals } from "@/lib/typographySignals";
import { cleanExtractedRowValue } from "@/lib/extractedValueCleanup";

export type ProductCategory = "Outdoor tent" | "Trade show booth";
export type StylePreference =
  | "Modern"
  | "Conservative"
  | "Traditional"
  | "Playful";

export const OUTDOOR_COMPONENTS = [
  "Canopy tent",
  "Back wall",
  "Side wall",
  "Flag",
] as const;

export const BOOTH_COMPONENTS = [
  "Backdrop",
  "Counter",
  "Header",
  "Product/service panels",
] as const;

export type OutdoorComponent = (typeof OUTDOOR_COMPONENTS)[number];
export type BoothComponent = (typeof BOOTH_COMPONENTS)[number];

export type ExtractedKey =
  | "logo"
  | "brandColors"
  | "phone"
  | "email"
  | "address"
  | "social"
  | "services"
  | "products";

export const EXTRACTED_LABELS: Record<ExtractedKey, string> = {
  logo: "Logo found",
  brandColors: "Brand colors",
  phone: "Phone number",
  email: "Email",
  address: "Address",
  social: "Social media",
  services: "Services",
  products: "Products",
};

export type ExtractedRow = { value: string; useForDesign: boolean };

/** Default business label in the editor demo; safe to replace after Analyze when unchanged. */
export const DEFAULT_DEMO_BUSINESS_NAME = "Example Brand Co.";

/** How extracted rows were last filled by “Analyze Website”. */
export type ExtractionSource = "none" | "claude" | "mock_fallback";

export interface DesignIntakeState {
  websiteUrl: string;
  businessName: string;
  category: ProductCategory;
  style: StylePreference;
  instructions: string;
  componentsOutdoor: Record<OutdoorComponent, boolean>;
  componentsBooth: Record<BoothComponent, boolean>;
  extracted: Record<ExtractedKey, ExtractedRow>;
  /** True after “Analyze Website” loads mock extraction into the form. */
  showExtracted: boolean;
  /** Last successful analyze path (Claude API vs local mock). */
  extractionSource: ExtractionSource;
  /**
   * Logo image candidates returned by the most recent successful website
   * extraction. Empty when none, or before Analyze runs. Server-side only —
   * the client just passes them through to the review UI.
   */
  logoCandidates: LogoCandidate[];
  /** URL of the candidate the user marked as "Use this logo", or "" when none. */
  selectedLogoCandidateUrl: string;
  /**
   * Typography signals from the last successful website extraction (server-ranked).
   * Used for canvas font mapping only — not exact production font matching.
   */
  typographySignals: TypographySignals | null;
  designBrief: string;
}

const MOCK_EXTRACTED: Record<ExtractedKey, string> = {
  logo: "SVG mark detected (mock) — “EB” monogram",
  brandColors: "Primary #0B2E4A · Accent #2BB3A3 · Neutral #F4F4F5",
  phone: "(555) 010-2030",
  email: "hello@examplebrand.com",
  address: "123 Display Ave, Austin, TX 78701",
  social: "linkedin.com/company/exampleco · instagram.com/exampleco",
  services: "Custom trade displays, event branding, install & teardown",
  products: "10×10 canopy tents, modular booths, backlit headers",
};

/** Empty extraction rows (no mock values). */
export function emptyExtracted(): Record<ExtractedKey, ExtractedRow> {
  return {
    logo: { value: "", useForDesign: false },
    brandColors: { value: "", useForDesign: false },
    phone: { value: "", useForDesign: false },
    email: { value: "", useForDesign: false },
    address: { value: "", useForDesign: false },
    social: { value: "", useForDesign: false },
    services: { value: "", useForDesign: false },
    products: { value: "", useForDesign: false },
  };
}

/** Default “include on design” when rows are populated from analyze flows. */
export const DEFAULT_EXTRACTED_USE_FOR_DESIGN: Readonly<
  Record<ExtractedKey, boolean>
> = {
  logo: true,
  brandColors: true,
  phone: true,
  email: true,
  address: false,
  social: true,
  services: true,
  products: true,
};

const MAX_EXTRACTED_FIELD_CHARS = 2000;

function clampExtractedValue(raw: string): string {
  const t = raw.trim();
  if (t.length <= MAX_EXTRACTED_FIELD_CHARS) return t;
  return t.slice(0, MAX_EXTRACTED_FIELD_CHARS);
}

/**
 * Build extracted rows from plain string values (e.g. Claude JSON). Each value
 * is clamped to a max length and then run through a per-field cleanup pass
 * (see `extractedValueCleanup.ts`) so multi-page scrape leftovers (empty parens,
 * stray fragments, repeated punctuation) do not surface in the UI / brief.
 */
export function buildExtractedFromPlainValues(
  input: Record<string, unknown>,
): Record<ExtractedKey, ExtractedRow> {
  const next = emptyExtracted();
  (Object.keys(next) as ExtractedKey[]).forEach((key) => {
    let raw = input[key];
    if (
      key === "brandColors" &&
      (raw === undefined || raw === null || raw === "") &&
      typeof input.colors === "string"
    ) {
      raw = input.colors;
    }
    const str =
      typeof raw === "string"
        ? clampExtractedValue(raw)
        : typeof raw === "number" && Number.isFinite(raw)
          ? clampExtractedValue(String(raw))
          : "";
    const cleaned = cleanExtractedRowValue(key, str);
    next[key] = {
      value: cleaned,
      useForDesign:
        cleaned.length > 0 ? DEFAULT_EXTRACTED_USE_FOR_DESIGN[key] : false,
    };
  });
  return next;
}

/** Mock extraction with defaults for fields that should appear on the design by default. */
export function buildMockExtracted(): Record<ExtractedKey, ExtractedRow> {
  const next = emptyExtracted();
  (Object.keys(MOCK_EXTRACTED) as ExtractedKey[]).forEach((key) => {
    next[key] = {
      value: MOCK_EXTRACTED[key],
      useForDesign: DEFAULT_EXTRACTED_USE_FOR_DESIGN[key],
    };
  });
  return next;
}

/** Selected product component labels for UI / brief. */
export function getSelectedProductComponents(intake: DesignIntakeState): string[] {
  return intake.category === "Outdoor tent"
    ? OUTDOOR_COMPONENTS.filter((c) => intake.componentsOutdoor[c])
    : BOOTH_COMPONENTS.filter((c) => intake.componentsBooth[c]);
}

/** Extracted rows that are checked and non-empty (for live summary). */
export function getSelectedExtractedLabels(intake: DesignIntakeState): string[] {
  return (Object.keys(EXTRACTED_LABELS) as ExtractedKey[]).filter((key) => {
    const row = intake.extracted[key];
    return row.useForDesign && row.value.trim().length > 0;
  }).map((k) => EXTRACTED_LABELS[k]);
}

/**
 * Builds the design brief text from the current intake snapshot.
 * Uses `intake.extracted` as-is (caller should merge mock extraction first if needed).
 */
export function computeDesignBriefText(intake: DesignIntakeState): string {
  const selectedComponents = getSelectedProductComponents(intake);

  const header =
    intake.extractionSource === "claude"
      ? "DESIGN BRIEF (prototype — Claude-inferred fields, not scraped)"
      : intake.extractionSource === "mock_fallback"
        ? "DESIGN BRIEF (prototype — mocked extraction fallback)"
        : "DESIGN BRIEF (prototype — mock extraction)";

  const lines: string[] = [
    header,
    "================================",
    "",
    `Business: ${intake.businessName.trim() || "(not provided)"}`,
    `Website: ${intake.websiteUrl.trim() || "(not provided)"}`,
    `Product category: ${intake.category}`,
    `Style preference: ${intake.style}`,
    "",
    "Requested product components:",
    selectedComponents.length
      ? selectedComponents.map((c) => `  • ${c}`).join("\n")
      : "  (none selected)",
    "",
  ];

  if (intake.instructions.trim()) {
    lines.push("Customer / special instructions:");
    lines.push(intake.instructions.trim());
    lines.push("");
  }

  if (intake.selectedLogoCandidateUrl.trim()) {
    lines.push("Selected logo candidate (for designer review):");
    lines.push(`  • ${intake.selectedLogoCandidateUrl.trim()}`);
    lines.push(
      "  (Production-quality logo upload still recommended before print.)",
    );
    lines.push("");
  } else if (
    intake.extractionSource !== "none" &&
    intake.extracted.logo.value.trim().length > 0
  ) {
    /**
     * No image candidate selected (e.g. site exposed only a tiny favicon, or
     * none at all), but Claude still produced a textual logo description.
     * Make the gap explicit for the designer rather than letting the brief
     * imply a usable asset is on file.
     */
    lines.push(
      "Logo described from website analysis; production logo file still needed.",
    );
    lines.push("");
  }

  lines.push("Selected extracted content (for design use):");
  const selectedExtractedLines: string[] = [];
  (Object.keys(EXTRACTED_LABELS) as ExtractedKey[]).forEach((key) => {
    const row = intake.extracted[key];
    if (!row.useForDesign || !row.value.trim()) return;
    selectedExtractedLines.push(
      `  • ${EXTRACTED_LABELS[key]}: ${row.value.trim()}`,
    );
  });
  if (selectedExtractedLines.length === 0) {
    lines.push("  No extracted content selected yet");
  } else {
    lines.push(...selectedExtractedLines);
  }

  lines.push("");
  lines.push("— End of brief —");

  return lines.join("\n");
}

export function defaultDesignIntake(): DesignIntakeState {
  const base: DesignIntakeState = {
    websiteUrl: "https://examplebrand.com",
    businessName: DEFAULT_DEMO_BUSINESS_NAME,
    category: "Outdoor tent",
    style: "Modern",
    instructions: "",
    componentsOutdoor: {
      "Canopy tent": true,
      "Back wall": false,
      "Side wall": false,
      Flag: false,
    },
    componentsBooth: {
      Backdrop: true,
      Counter: false,
      Header: false,
      "Product/service panels": false,
    },
    extracted: emptyExtracted(),
    showExtracted: false,
    extractionSource: "none",
    logoCandidates: [],
    selectedLogoCandidateUrl: "",
    typographySignals: null,
    designBrief: "",
  };
  return { ...base, designBrief: computeDesignBriefText(base) };
}
