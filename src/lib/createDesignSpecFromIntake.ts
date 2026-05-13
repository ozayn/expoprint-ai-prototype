import type { BrandColors, DesignSpec, TextLayer } from "./designSpec";
import type { DesignIntakeState, ExtractedKey, StylePreference } from "./designIntakeState";
import {
  BOOTH_COMPONENTS,
  getSelectedProductComponents,
  OUTDOOR_COMPONENTS,
} from "./designIntakeState";

const CANVAS = { width: 1000, height: 600 } as const;

const FALLBACK_COLORS: BrandColors = {
  navy: "#0B2E4A",
  teal: "#2BB3A3",
  white: "#FFFFFF",
};

function parseHexColors(text: string): string[] {
  const re = /#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let h = m[0];
    if (h.length === 4) {
      const [, r, g, b] = h;
      h = `#${r}${r}${g}${g}${b}${b}`;
    }
    out.push(h);
  }
  return out;
}

function brandColorsFromExtracted(intake: DesignIntakeState): BrandColors {
  const row = intake.extracted.brandColors;
  if (!row.useForDesign || !row.value.trim()) {
    return { ...FALLBACK_COLORS };
  }
  const hexes = parseHexColors(row.value);
  if (hexes.length === 0) {
    return { ...FALLBACK_COLORS };
  }
  const navy = hexes[0] ?? FALLBACK_COLORS.navy;
  const teal = hexes[1] ?? FALLBACK_COLORS.teal;
  const white =
    hexes.length >= 3 ? hexes[2]! : FALLBACK_COLORS.white;
  return {
    navy,
    teal,
    white,
    paletteNote: row.value.trim(),
  };
}

function selectedExtractedValue(
  intake: DesignIntakeState,
  key: ExtractedKey,
): string {
  const row = intake.extracted[key];
  if (!row.useForDesign || !row.value.trim()) return "";
  return row.value.trim();
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function initialsFromBusinessName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]![0];
    const b = parts[1]![0];
    if (a && b) return `${a}${b}`.toUpperCase();
  }
  if (parts.length === 1) {
    const w = parts[0]!;
    if (w.length >= 2) return w.slice(0, 2).toUpperCase();
    if (w.length === 1) return w.toUpperCase();
  }
  return "LOGO";
}

function domainFromWebsiteUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return "";
  try {
    const withProto = /^(https?:)?\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withProto);
    return u.hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function headlineFromIntake(intake: DesignIntakeState): string {
  const n = intake.businessName.trim();
  return n ? truncate(n, 72) : "Custom Displays for Modern Brands";
}

function supportingFromIntake(intake: DesignIntakeState): string {
  const services = selectedExtractedValue(intake, "services");
  if (services) return truncate(services, 160);
  const products = selectedExtractedValue(intake, "products");
  if (products) return truncate(products, 160);
  const comps =
    intake.category === "Outdoor tent"
      ? OUTDOOR_COMPONENTS.filter((c) => intake.componentsOutdoor[c])
      : BOOTH_COMPONENTS.filter((c) => intake.componentsBooth[c]);
  if (comps.length) return comps.join(" · ");
  return "Trade show booths • Canopy tents • Event displays";
}

function websiteLineFromIntake(intake: DesignIntakeState): string {
  const d = domainFromWebsiteUrl(intake.websiteUrl);
  return d || "expoprint.io";
}

/** First social token (e.g. one platform segment) for a compact canvas line. */
function shortSocialForCanvas(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const first = t.split(/\s*[·•|]\s*/)[0]?.trim() ?? t;
  return truncate(first.replace(/^@+/, ""), 38);
}

/** Any selected extracted contact field that should appear on the canvas. */
function hasContactExtractedForCanvas(intake: DesignIntakeState): boolean {
  return (
    !!selectedExtractedValue(intake, "phone") ||
    !!selectedExtractedValue(intake, "email") ||
    !!selectedExtractedValue(intake, "social") ||
    (intake.category === "Trade show booth" &&
      !!selectedExtractedValue(intake, "address"))
  );
}

const CONTACT_LINE_MAX = 96;

/**
 * One concise footer line: prefer phone · domain when phone is selected;
 * add email / social / booth address only when there is room (single line cap).
 */
function buildContactFooterLine(intake: DesignIntakeState): string {
  if (!hasContactExtractedForCanvas(intake)) return "";

  const phone = selectedExtractedValue(intake, "phone");
  const email = selectedExtractedValue(intake, "email");
  const social = selectedExtractedValue(intake, "social");
  const address =
    intake.category === "Trade show booth"
      ? selectedExtractedValue(intake, "address")
      : "";

  const domain = websiteLineFromIntake(intake);
  const socialShort = social ? shortSocialForCanvas(social) : "";

  const fits = (base: string, extra: string) =>
    base.length + 3 + extra.length <= CONTACT_LINE_MAX;

  if (phone) {
    let line = `${truncate(phone, 24)} · ${truncate(domain, 30)}`;
    if (email && fits(line, truncate(email, 32))) {
      line = `${line} · ${truncate(email, 32)}`;
    } else if (email && line.length <= 58 && fits(line, truncate(email, 22))) {
      line = `${line} · ${truncate(email, 22)}`;
    }
    if (socialShort && fits(line, socialShort)) {
      line = `${line} · ${socialShort}`;
    }
    if (address && fits(line, truncate(address, 36))) {
      line = `${line} · ${truncate(address, 36)}`;
    }
    return truncate(line, CONTACT_LINE_MAX);
  }

  const parts: string[] = [];
  if (socialShort) parts.push(socialShort);
  if (email) parts.push(truncate(email, 40));
  if (address) parts.push(truncate(address, 48));

  if (parts.length === 0) return "";

  let line = parts[0]!;
  for (let i = 1; i < parts.length; i++) {
    const next = `${line} · ${parts[i]}`;
    if (next.length <= CONTACT_LINE_MAX) line = next;
    else break;
  }
  return truncate(line, CONTACT_LINE_MAX);
}

function logoLabelFromIntake(intake: DesignIntakeState): string {
  return intake.businessName.trim()
    ? initialsFromBusinessName(intake.businessName)
    : "LOGO";
}

type TextBlock = Pick<TextLayer, "left" | "top" | "width" | "textAlign">;

type StyleLayout = {
  accentOpacity: number;
  accentPoints: { x: number; y: number }[];
  accentAngle: number;
  headline: TextBlock;
  supporting: TextBlock;
  website: TextBlock;
};

function layoutForStyle(style: StylePreference): StyleLayout {
  const modern: StyleLayout = {
    accentOpacity: 0.92,
    accentPoints: [
      { x: 0, y: 0 },
      { x: 480, y: 0 },
      { x: 0, y: 560 },
    ],
    accentAngle: 0,
    headline: { left: 260, top: 160, width: 700, textAlign: undefined },
    supporting: { left: 260, top: 288, width: 700, textAlign: undefined },
    website: { left: 260, top: 508, width: 700, textAlign: undefined },
  };

  switch (style) {
    case "Conservative":
      return {
        ...modern,
        accentOpacity: 0.38,
      };
    case "Traditional":
      return {
        accentOpacity: 0.72,
        accentPoints: [
          { x: 0, y: 0 },
          { x: 420, y: 0 },
          { x: 0, y: 520 },
        ],
        accentAngle: 0,
        headline: {
          left: 170,
          top: 165,
          width: 660,
          textAlign: "center",
        },
        supporting: {
          left: 170,
          top: 292,
          width: 660,
          textAlign: "center",
        },
        website: {
          left: 170,
          top: 505,
          width: 660,
          textAlign: "center",
        },
      };
    case "Playful":
      return {
        accentOpacity: 0.95,
        accentPoints: [
          { x: 0, y: 0 },
          { x: 580, y: 0 },
          { x: 0, y: 590 },
        ],
        accentAngle: 14,
        headline: { left: 240, top: 155, width: 720, textAlign: undefined },
        supporting: { left: 240, top: 285, width: 720, textAlign: undefined },
        website: { left: 240, top: 502, width: 720, textAlign: undefined },
      };
    case "Modern":
    default:
      return modern;
  }
}

/** URL-safe fragment for templateId from a surface display name. */
function surfaceSlugForTemplate(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "surface";
}

function resolveActiveSurfaceLabel(
  intake: DesignIntakeState,
  activeSurface: string | null | undefined,
): string | null {
  const selected = getSelectedProductComponents(intake);
  if (selected.length === 0) return null;
  if (activeSurface && selected.includes(activeSurface)) return activeSurface;
  return selected[0] ?? null;
}

/**
 * Builds a 1000×600 DesignSpec from the current intake form + selected extracted rows.
 * Layout varies slightly by style preference for visible demo differentiation.
 * @param activeSurface — checked product component to tag in metadata (single artboard for now).
 */
export function createDesignSpecFromIntake(
  intake: DesignIntakeState,
  activeSurface?: string | null,
): DesignSpec {
  const colors = brandColorsFromExtracted(intake);
  const headline = headlineFromIntake(intake);
  const supporting = supportingFromIntake(intake);
  const website = websiteLineFromIntake(intake);
  const logoLabel = logoLabelFromIntake(intake);
  const layout = layoutForStyle(intake.style);

  const contactFooter = buildContactFooterLine(intake);
  const hasContactFooter = contactFooter.length > 0;
  /** Nudge main URL up slightly so a small contact line fits above the bottom edge. */
  const websiteTop = hasContactFooter ? layout.website.top - 26 : layout.website.top;
  const contactFooterTop = websiteTop + 36;

  const surfaceLabel = resolveActiveSurfaceLabel(intake, activeSurface);
  const surfaceSlug = surfaceLabel ? surfaceSlugForTemplate(surfaceLabel) : "none";
  const productType = surfaceLabel
    ? `${intake.category} — ${surfaceLabel} (${intake.style})`
    : `${intake.category} (${intake.style})`;
  const templateId = `intake-preview-v1|${intake.category}|surface:${surfaceSlug}|${intake.style}`;

  const textBase = {
    fontFamily: "system-ui, -apple-system, sans-serif",
  } as const;

  const layers: DesignSpec["layers"] = [
    {
      type: "background",
      id: "bg",
      fill: colors.navy,
    },
    {
      type: "polygon",
      id: "accent-diagonal",
      points: layout.accentPoints,
      left: 0,
      top: 0,
      fill: colors.teal,
      opacity: layout.accentOpacity,
      strokeWidth: 0,
      angle: layout.accentAngle,
    },
    {
      type: "imagePlaceholder",
      id: "logo-box",
      left: 72,
      top: 72,
      width: 132,
      height: 132,
      fill: colors.white,
      stroke: colors.teal,
      strokeWidth: 3,
      strokeDashArray: [10, 8],
    },
    {
      type: "text",
      id: "logo-label",
      content: logoLabel,
      left: 96,
      top: 128,
      fill: colors.navy,
      fontSize: 28,
      ...textBase,
      fontWeight: "600",
      opacity: 0.45,
    },
    {
      type: "text",
      id: "headline",
      content: headline,
      left: layout.headline.left,
      top: layout.headline.top,
      fill: colors.white,
      fontSize: 44,
      ...textBase,
      fontWeight: "700",
      width: layout.headline.width,
      textAlign: layout.headline.textAlign,
    },
    {
      type: "text",
      id: "supporting",
      content: supporting,
      left: layout.supporting.left,
      top: layout.supporting.top,
      fill: colors.teal,
      fontSize: 22,
      ...textBase,
      width: layout.supporting.width,
      textAlign: layout.supporting.textAlign,
    },
    {
      type: "text",
      id: "website",
      content: website,
      left: layout.website.left,
      top: websiteTop,
      fill: colors.white,
      fontSize: 28,
      ...textBase,
      fontWeight: "500",
      width: layout.website.width,
      textAlign: layout.website.textAlign,
    },
  ];

  if (hasContactFooter) {
    layers.push({
      type: "text",
      id: "contact-footer",
      content: contactFooter,
      left: layout.website.left,
      top: contactFooterTop,
      fill: colors.teal,
      fontSize: 14,
      ...textBase,
      fontWeight: "400",
      width: layout.website.width,
      textAlign: layout.website.textAlign,
      opacity: 0.92,
    });
  }

  return {
    canvas: { ...CANVAS },
    productType,
    templateId,
    brandColors: colors,
    layers,
  };
}

/**
 * Whether “Generate Sample Concept” should build from intake instead of `sampleDesignSpec`.
 * Uses any clear signal that the user is designing from the form (not only `showExtracted`),
 * so the demo stays predictable after Analyze / brief or with prefilled name/URL.
 */
export function shouldUseIntakeDesignSpec(intake: DesignIntakeState): boolean {
  if (intake.showExtracted) return true;
  if (intake.designBrief.trim().length > 0) return true;
  if (intake.instructions.trim().length > 0) return true;
  if (intake.businessName.trim().length > 0) return true;
  if (intake.websiteUrl.trim().length > 0) return true;
  return false;
}
