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

/** Mock extraction with defaults for fields that should appear on the design by default. */
export function buildMockExtracted(): Record<ExtractedKey, ExtractedRow> {
  const defaults: Record<ExtractedKey, boolean> = {
    logo: true,
    brandColors: true,
    phone: true,
    email: true,
    address: false,
    social: true,
    services: true,
    products: true,
  };
  const next = emptyExtracted();
  (Object.keys(MOCK_EXTRACTED) as ExtractedKey[]).forEach((key) => {
    next[key] = {
      value: MOCK_EXTRACTED[key],
      useForDesign: defaults[key],
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

  const lines: string[] = [
    "DESIGN BRIEF (prototype — mock extraction)",
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
    businessName: "Example Brand Co.",
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
    designBrief: "",
  };
  return { ...base, designBrief: computeDesignBriefText(base) };
}
