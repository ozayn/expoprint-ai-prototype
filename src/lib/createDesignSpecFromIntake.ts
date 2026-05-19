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

/**
 * Strips `https?://`, `www.`, query/hash, trailing slash, and trailing
 * punctuation from a URL-ish token. Returns `""` if nothing recognizable
 * remains (i.e. no host-like `name.tld`). Never returns a partial URL.
 */
function shortenSocialToken(rawToken: string): string {
  let t = rawToken.trim();
  if (!t) return "";
  /** Mid-list garbage like `, h` or stray ellipses. */
  if (t.length < 3) return "";
  t = t.replace(/^[\s.,;:·•|@]+|[\s.,;:·•|]+$/g, "");
  if (!t) return "";

  /** Bare handles (e.g. `@google`) — keep but without the leading @. */
  const handleMatch = /^@?([A-Za-z0-9_.]{2,30})$/.exec(t);
  if (handleMatch && !t.includes("/") && !t.includes(".")) {
    return `@${handleMatch[1]}`;
  }

  /**
   * URL-ish: prepend a scheme so `URL` parses host/path/query reliably; we
   * never re-emit the scheme.
   */
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return "";
  }
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host)) return "";

  const cleanedPath = url.pathname
    .replace(/\/+$/, "")
    .replace(/[\s.,;:·•|]+$/, "");

  const display = cleanedPath ? `${host}${cleanedPath}` : host;
  /** Trailing punctuation belt-and-suspenders. */
  return display.replace(/[\s.,;:·•|]+$/, "");
}

/**
 * Pick the cleanest single social token from a Claude-style list (comma /
 * semicolon / mid-dot / pipe separated). Prefers tokens that produce a short
 * displayable form (`youtube.com/googleads`, `@brand`, `instagram.com/foo`).
 * Returns `""` when no token cleans up below the per-item display cap.
 */
const SOCIAL_DISPLAY_MAX = 40;

function shortSocialForCanvas(raw: string): string {
  const t = raw.trim();
  if (!t) return "";

  const tokens = t
    .split(/\s*[,;·•|]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const tok of tokens) {
    const cleaned = shortenSocialToken(tok);
    if (cleaned && cleaned.length <= SOCIAL_DISPLAY_MAX) {
      return cleaned;
    }
  }
  return "";
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
const CONTACT_SEPARATOR = " · ";
const EMAIL_DISPLAY_MAX = 32;
const ADDRESS_DISPLAY_MAX = 40;

/**
 * One concise footer line. Items are added in priority order
 * (phone → domain → short email → one clean social → booth address) and
 * **whole items are dropped** when adding them would exceed `CONTACT_LINE_MAX`.
 * The line is never cut mid-token, so users do not see partial URLs like
 * `youtube.com/googleads, h…` on the canvas. Returns `""` when no extra
 * contact item is clean — the main website layer carries the domain alone.
 */
function buildContactFooterLine(intake: DesignIntakeState): string {
  if (!hasContactExtractedForCanvas(intake)) return "";

  const phone = selectedExtractedValue(intake, "phone").trim();
  const email = selectedExtractedValue(intake, "email").trim();
  const socialRaw = selectedExtractedValue(intake, "social").trim();
  const social = socialRaw ? shortSocialForCanvas(socialRaw) : "";
  const address =
    intake.category === "Trade show booth"
      ? selectedExtractedValue(intake, "address").trim()
      : "";

  const domain = websiteLineFromIntake(intake);

  const ordered: string[] = [];
  if (phone) ordered.push(phone);
  /** Only anchor the domain in the footer when at least one other item rides with it. */
  const hasSecondaryItem =
    Boolean(phone) ||
    (email.length > 0 && email.length <= EMAIL_DISPLAY_MAX) ||
    Boolean(social) ||
    (address.length > 0 && address.length <= ADDRESS_DISPLAY_MAX);
  if (hasSecondaryItem && domain && phone) {
    ordered.push(domain);
  }
  if (email && email.length <= EMAIL_DISPLAY_MAX) ordered.push(email);
  if (social) ordered.push(social);
  if (address && address.length <= ADDRESS_DISPLAY_MAX) ordered.push(address);

  /** Case-insensitive dedup so domain/email twins do not stack. */
  const seen = new Set<string>();
  const unique = ordered.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let line = "";
  for (const item of unique) {
    if (item.length > CONTACT_LINE_MAX) continue;
    const next = line ? `${line}${CONTACT_SEPARATOR}${item}` : item;
    if (next.length <= CONTACT_LINE_MAX) {
      line = next;
    }
    /** else: skip this item but keep trying smaller ones. */
  }
  return line;
}

function logoLabelFromIntake(intake: DesignIntakeState): string {
  return intake.businessName.trim()
    ? initialsFromBusinessName(intake.businessName)
    : "LOGO";
}

/**
 * Build the same-origin proxy URL for the selected candidate. We never put the
 * remote URL on the canvas directly — Fabric loads through `/api/proxy-image`
 * with `crossOrigin: "anonymous"` so PNG export stays untainted, and the proxy
 * enforces protocol / private-IP / MIME / size limits.
 */
function proxiedLogoUrl(remoteUrl: string): string {
  return `/api/proxy-image?url=${encodeURIComponent(remoteUrl)}`;
}

/**
 * One-or-zero `image` layer for the selected logo candidate. The renderer adds
 * this asynchronously and only removes the placeholder + label layers
 * (`logo-box` / `logo-label` / `logo-label-sub`) when the image actually loads
 * — so failures or CORS hiccups still leave the safe placeholder visible.
 */
function buildSelectedLogoImageLayer(
  intake: DesignIntakeState,
): DesignSpec["layers"] {
  const remote =
    typeof intake.selectedLogoCandidateUrl === "string"
      ? intake.selectedLogoCandidateUrl.trim()
      : "";
  if (!remote || !/^https?:\/\//i.test(remote)) return [];
  return [
    {
      type: "image",
      id: "logo-image",
      src: proxiedLogoUrl(remote),
      left: 72,
      top: 72,
      width: 132,
      height: 132,
      padding: 10,
      replacePlaceholderIds: ["logo-box", "logo-label", "logo-label-sub"],
    },
  ];
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

  const baseLogoStrokeWidth = polyScale < 0.68 ? 4 : 3;
  const logoDash: [number, number] = polyScale < 0.68 ? [14, 11] : [12, 10];
  /**
   * Signals that the user picked a logo candidate from the website extraction.
   * Canvas behavior is intentionally simple to avoid CORS / tainted-canvas
   * issues on PNG export: keep the editable placeholder, switch the dashed
   * stroke to a solid stroke (one step bolder), and swap the LOGO/initials
   * label for a two-line "Logo selected / candidate recorded" stack so users
   * do not believe the remote image is embedded. The actual URL is recorded
   * in the design brief for the designer.
   */
  const hasSelectedLogoCandidate =
    typeof intake.selectedLogoCandidateUrl === "string" &&
    intake.selectedLogoCandidateUrl.trim().length > 0;
  const logoStrokeWidth = hasSelectedLogoCandidate
    ? baseLogoStrokeWidth + 1
    : baseLogoStrokeWidth;
  const logoStrokeDash: number[] | undefined = hasSelectedLogoCandidate
    ? undefined
    : [...logoDash];

  /**
   * Logo placeholder text layers.
   * - No candidate: single "LOGO" / initials line, dashed stroke (set above).
   * - Candidate selected: two centered textbox lines stacked inside the 132px
   *   box — `Logo selected` (16px) over a smaller `candidate recorded` (10px)
   *   subtitle. Solid stroke is applied at the imagePlaceholder layer.
   */
  const logoLabelLayers: DesignSpec["layers"] = hasSelectedLogoCandidate
    ? [
        {
          type: "text",
          id: "logo-label",
          content: "Logo selected",
          left: 72,
          top: 122,
          width: 132,
          fill: plan.logoLabelText,
          fontSize: 16,
          ...textBase,
          fontWeight: "600",
          opacity: 0.85,
          textAlign: "center",
          textLayout: "textbox",
        },
        {
          type: "text",
          id: "logo-label-sub",
          content: "candidate recorded",
          left: 72,
          top: 146,
          width: 132,
          fill: plan.logoLabelText,
          fontSize: 10,
          ...textBase,
          fontWeight: "500",
          opacity: 0.6,
          textAlign: "center",
          textLayout: "textbox",
        },
      ]
    : [
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
      ];

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
      ...(logoStrokeDash ? { strokeDashArray: logoStrokeDash } : {}),
    },
    ...logoLabelLayers,
    ...buildSelectedLogoImageLayer(intake),
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
