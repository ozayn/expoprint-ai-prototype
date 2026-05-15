import type { DesignSpec, TextLayer } from "./designSpec";
import type { DesignIntakeState, ExtractedKey, StylePreference } from "./designIntakeState";
import {
  BOOTH_COMPONENTS,
  getSelectedProductComponents,
  OUTDOOR_COMPONENTS,
} from "./designIntakeState";
import { buildConceptColorPlan } from "./designStyleGuide";

const CANVAS = { width: 1000, height: 600 } as const;

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

/** Greedy word-wrap line count (prototype); assumes ~Latin average glyph width. */
function estimateWrappedLineCount(
  text: string,
  boxWidthPx: number,
  avgCharWidthPx: number,
): number {
  const t = text.trim();
  if (!t) return 1;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  let lines = 1;
  let lineW = 0;
  const space = avgCharWidthPx;
  for (const word of words) {
    const wordW = word.length * avgCharWidthPx;
    if (lineW <= 0) {
      lineW = wordW;
      continue;
    }
    if (lineW + space + wordW <= boxWidthPx) {
      lineW += space + wordW;
    } else {
      lines++;
      lineW = wordW;
    }
  }
  return lines;
}

const DEFAULT_SUPPORTING_LINE =
  "Trade show booths • Canopy tents • Event displays";
const MAX_SUPPORTING_SEGMENT_CHARS = 46;
const MAX_SUPPORTING_INITIAL_SEGMENTS = 7;
const MIN_SUPPORTING_FONT = 20;
const MAX_SUPPORTING_FONT = 24;
const SUPPORTING_LINE_HEIGHT_FACTOR = 1.28;
const SUPPORTING_CHAR_WIDTH_FACTOR = 0.52;

/**
 * Split long service/product blobs (commas, semicolons, bullets) into short segments
 * for a calmer ExpoPrint-style supporting line.
 */
function compactSupportingSegments(raw: string): string[] {
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  let parts = normalized
    .split(/\s*[,;]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    parts = normalized
      .split(/\s*[·•]\s*/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  if (parts.length === 0) {
    return [truncate(normalized, MAX_SUPPORTING_SEGMENT_CHARS * 2)];
  }

  return parts
    .slice(0, MAX_SUPPORTING_INITIAL_SEGMENTS)
    .map((p) => truncate(p.replace(/\s+/g, " "), MAX_SUPPORTING_SEGMENT_CHARS));
}

/**
 * Pick font size and optional trimming so wrapped supporting copy stays above the website line.
 * Prototype heuristic only — not a substitute for real layout or print proofing.
 */
function finalizeSupportingForConcept(
  raw: string,
  widthPx: number,
  maxHeightPx: number,
): { content: string; fontSize: number } {
  const safeWidth = Math.max(120, widthPx);
  const safeHeight = Math.max(
    MIN_SUPPORTING_FONT * SUPPORTING_LINE_HEIGHT_FACTOR,
    maxHeightPx,
  );

  const joinSegments = (segments: string[]) => segments.join(" · ");

  let segments = compactSupportingSegments(raw);
  if (segments.length === 0) {
    segments = compactSupportingSegments(DEFAULT_SUPPORTING_LINE);
  }

  const countLines = (text: string, fs: number) =>
    estimateWrappedLineCount(text, safeWidth, fs * SUPPORTING_CHAR_WIDTH_FACTOR);

  const fits = (text: string, fs: number) => {
    const lines = countLines(text, fs);
    return lines * fs * SUPPORTING_LINE_HEIGHT_FACTOR <= safeHeight;
  };

  let text = joinSegments(segments);
  while (segments.length > 1 && !fits(text, MAX_SUPPORTING_FONT)) {
    segments = segments.slice(0, -1);
    text = joinSegments(segments);
  }

  let fontSize = MAX_SUPPORTING_FONT;
  while (fontSize > MIN_SUPPORTING_FONT && !fits(text, fontSize)) {
    fontSize -= 1;
  }

  while (!fits(text, fontSize) && text.length > 28) {
    text = truncate(text, Math.max(28, text.length - 10));
  }

  const maxLinesBudget = Math.max(
    1,
    Math.floor(safeHeight / (fontSize * SUPPORTING_LINE_HEIGHT_FACTOR)),
  );
  while (countLines(text, fontSize) > maxLinesBudget && text.length > 24) {
    const idx = text.lastIndexOf(" · ");
    if (idx >= 28) {
      text = `${text.slice(0, idx).trimEnd()}…`;
    } else {
      text = truncate(text, Math.max(28, text.length - 12));
    }
  }

  return { content: text, fontSize };
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

function supportingRawFromIntake(intake: DesignIntakeState): string {
  const services = selectedExtractedValue(intake, "services");
  if (services) return services;
  const products = selectedExtractedValue(intake, "products");
  if (products) return products;
  const comps =
    intake.category === "Outdoor tent"
      ? OUTDOOR_COMPONENTS.filter((c) => intake.componentsOutdoor[c])
      : BOOTH_COMPONENTS.filter((c) => intake.componentsBooth[c]);
  if (comps.length) return comps.join(" · ");
  return DEFAULT_SUPPORTING_LINE;
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
  /** Prototype style-guide normalization (see `designStyleGuide.ts`) — not print-ready CMYK. */
  const plan = buildConceptColorPlan(intake);
  const headline = headlineFromIntake(intake);
  const supportingRaw = supportingRawFromIntake(intake);
  const website = websiteLineFromIntake(intake);
  const logoLabel = logoLabelFromIntake(intake);
  const layout = layoutForStyle(intake.style);

  const contactFooter = buildContactFooterLine(intake);
  const hasContactFooter = contactFooter.length > 0;

  const surfaceLabel = resolveActiveSurfaceLabel(intake, activeSurface);
  const surfaceSlug = surfaceLabel ? surfaceSlugForTemplate(surfaceLabel) : "none";
  const productType = surfaceLabel
    ? `${intake.category} — ${surfaceLabel} (${intake.style})`
    : `${intake.category} (${intake.style})`;
  const templateId = `intake-preview-v1|${intake.category}|surface:${surfaceSlug}|${intake.style}`;

  const textBase = {
    fontFamily: "system-ui, -apple-system, sans-serif",
  } as const;

  const accentOpacity = Math.min(
    1,
    layout.accentOpacity * plan.accentOpacityFactor,
  );
  const polyScale = plan.accentPolygonScale ?? 1;
  const accentPoints = layout.accentPoints.map((p) => ({
    x: p.x * polyScale,
    y: p.y * polyScale,
  }));

  /** Extra column offset when accent polygon is shrunk (loud palettes) — breathing room vs. logo. */
  const textShiftX = polyScale < 0.68 ? 24 : 0;
  const headlineBlock = {
    left: layout.headline.left + textShiftX,
    top: layout.headline.top,
    width: layout.headline.width,
    textAlign: layout.headline.textAlign,
  };
  const supportingBlock = {
    left: layout.supporting.left + textShiftX,
    top: layout.supporting.top,
    width: layout.supporting.width,
    textAlign: layout.supporting.textAlign,
  };
  const websiteBlock = {
    left: layout.website.left + textShiftX,
    top: layout.website.top,
    width: layout.website.width,
    textAlign: layout.website.textAlign,
  };
  /** Nudge main URL up slightly so a small contact line fits above the bottom edge. */
  const websiteTop = hasContactFooter ? websiteBlock.top - 26 : websiteBlock.top;
  const contactFooterTop = websiteTop + 36;

  const supportingMaxHeight = Math.max(
    40,
    websiteTop - supportingBlock.top - 14,
  );
  const supportingWidth = supportingBlock.width ?? 640;
  const supportingFit = finalizeSupportingForConcept(
    supportingRaw,
    supportingWidth,
    supportingMaxHeight,
  );

  const logoStrokeWidth = polyScale < 0.68 ? 4 : 3;
  const logoDash: [number, number] = polyScale < 0.68 ? [14, 11] : [12, 10];

  const layers: DesignSpec["layers"] = [
    {
      type: "background",
      id: "bg",
      fill: plan.backgroundColor,
    },
    {
      type: "polygon",
      id: "accent-diagonal",
      points: accentPoints,
      left: 0,
      top: 0,
      fill: plan.accentShape,
      opacity: accentOpacity,
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
      fill: plan.logoFill,
      stroke: plan.logoStroke,
      strokeWidth: logoStrokeWidth,
      strokeDashArray: [...logoDash],
    },
    {
      type: "text",
      id: "logo-label",
      content: logoLabel,
      left: 96,
      top: 128,
      fill: plan.logoLabelText,
      fontSize: 28,
      ...textBase,
      fontWeight: "600",
      opacity: 0.45,
    },
    {
      type: "text",
      id: "headline",
      content: headline,
      left: headlineBlock.left,
      top: headlineBlock.top,
      fill: plan.headlineText,
      fontSize: 48,
      ...textBase,
      fontWeight: "700",
      width: headlineBlock.width,
      textAlign: headlineBlock.textAlign,
    },
    {
      type: "text",
      id: "supporting",
      content: supportingFit.content,
      left: supportingBlock.left,
      top: supportingBlock.top,
      fill: plan.supportingText,
      fontSize: supportingFit.fontSize,
      ...textBase,
      width: supportingWidth,
      textAlign: supportingBlock.textAlign,
      textLayout: "textbox",
    },
    {
      type: "text",
      id: "website",
      content: website,
      left: websiteBlock.left,
      top: websiteTop,
      fill: plan.websiteText,
      fontSize: 30,
      ...textBase,
      fontWeight: "500",
      width: websiteBlock.width,
      textAlign: websiteBlock.textAlign,
    },
  ];

  if (hasContactFooter) {
    layers.push({
      type: "text",
      id: "contact-footer",
      content: contactFooter,
      left: websiteBlock.left,
      top: contactFooterTop,
      fill: plan.contactText,
      fontSize: 15,
      ...textBase,
      fontWeight: "400",
      width: websiteBlock.width,
      textAlign: websiteBlock.textAlign,
      opacity: 0.92,
    });
  }

  return {
    canvas: { ...CANVAS },
    productType,
    templateId,
    brandColors: plan.brandColors,
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
