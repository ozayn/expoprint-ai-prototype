/** Named brand palette; extra keys allowed for future AI output. */
export interface BrandColors {
  navy: string;
  teal: string;
  white: string;
  [key: string]: string;
}

export type SupportingContentLayout = "supporting-line" | "bullet-list";

/** Prototype debug hints for how intake copy was laid out on the artboard. */
export interface DesignSpecMetadata {
  contentLayout?: SupportingContentLayout;
  activeSurface?: string;
  supportingItemCount?: number;
}

export interface DesignSpec {
  canvas: { width: number; height: number };
  productType: string;
  templateId: string;
  brandColors: BrandColors;
  layers: DesignLayer[];
  metadata?: DesignSpecMetadata;
}

/** Fabric object origin; spec coordinates are top-left unless overridden. */
export type SpecOriginX = "left" | "center" | "right";
export type SpecOriginY = "top" | "center" | "bottom";

export interface BackgroundLayer {
  type: "background";
  id?: string;
  fill: string;
}

export interface RectLayer {
  type: "rect";
  id?: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDashArray?: number[];
  originX?: SpecOriginX;
  originY?: SpecOriginY;
}

export interface PolygonLayer {
  type: "polygon";
  id?: string;
  points: { x: number; y: number }[];
  left: number;
  top: number;
  fill?: string;
  opacity?: number;
  strokeWidth?: number;
  /** Degrees; passed to Fabric (e.g. playful accent). */
  angle?: number;
  originX?: SpecOriginX;
  originY?: SpecOriginY;
}

/** Rectangle or polygon artwork (not the dedicated full-canvas background). */
export type ShapeLayer = RectLayer | PolygonLayer;

export interface TextLayer {
  type: "text";
  id?: string;
  content: string;
  left: number;
  top: number;
  fontSize: number;
  fontFamily: string;
  fontWeight?: string;
  fill: string;
  width?: number;
  opacity?: number;
  textAlign?: "left" | "center" | "right" | "justify";
  originX?: SpecOriginX;
  originY?: SpecOriginY;
  /**
   * `"textbox"` → Fabric `Textbox` with `width` (word wrap). `"itext"` / omitted → `IText` (single-line flow).
   * Prototype: intake supporting copy uses textbox so long lists stay inside the column.
   */
  textLayout?: "itext" | "textbox";
  /** Fabric `Textbox` line height multiplier (e.g. bullet lists). */
  lineHeight?: number;
}

export interface ImagePlaceholderLayer {
  type: "imagePlaceholder";
  id?: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDashArray?: number[];
  originX?: SpecOriginX;
  originY?: SpecOriginY;
}

/**
 * Bitmap or SVG image fitted into a bounding box with `object-contain`-style
 * scaling. The renderer loads `src` asynchronously with `crossOrigin: "anonymous"`
 * so PNG export stays untainted; on load failure it leaves any siblings listed
 * in `replacePlaceholderIds` in place. Coordinates are top-left.
 */
export interface ImageLayer {
  type: "image";
  id?: string;
  /** Same-origin / CORS-clean URL (e.g. our `/api/proxy-image` proxy). */
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
  /** Inset within the bounding box before scaling, per side. Default 8. */
  padding?: number;
  /** Layer ids removed from the canvas only when the image actually loads. */
  replacePlaceholderIds?: string[];
  opacity?: number;
  originX?: SpecOriginX;
  originY?: SpecOriginY;
}

export type DesignLayer =
  | BackgroundLayer
  | ShapeLayer
  | TextLayer
  | ImagePlaceholderLayer
  | ImageLayer;

const sampleBrandColors: BrandColors = {
  navy: "#0B2E4A",
  teal: "#2BB3A3",
  white: "#FFFFFF",
};

export const sampleDesignSpec: DesignSpec = {
  canvas: { width: 1000, height: 600 },
  productType: "10x10 canopy tent",
  templateId: "canopy-10x10-v1",
  brandColors: sampleBrandColors,
  layers: [
    {
      type: "background",
      id: "bg",
      fill: sampleBrandColors.navy,
    },
    {
      type: "polygon",
      id: "accent-diagonal",
      points: [
        { x: 0, y: 0 },
        { x: 480, y: 0 },
        { x: 0, y: 560 },
      ],
      left: 0,
      top: 0,
      fill: sampleBrandColors.teal,
      opacity: 0.92,
      strokeWidth: 0,
    },
    {
      type: "imagePlaceholder",
      id: "logo-box",
      left: 72,
      top: 72,
      width: 132,
      height: 132,
      fill: sampleBrandColors.white,
      stroke: sampleBrandColors.teal,
      strokeWidth: 3,
      strokeDashArray: [10, 8],
    },
    {
      type: "text",
      id: "logo-label",
      content: "LOGO",
      left: 96,
      top: 128,
      fill: sampleBrandColors.navy,
      fontSize: 28,
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontWeight: "600",
      opacity: 0.45,
    },
    {
      type: "text",
      id: "headline",
      content: "Custom Displays for Modern Brands",
      left: 260,
      top: 160,
      fill: sampleBrandColors.white,
      fontSize: 44,
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontWeight: "700",
      width: 700,
    },
    {
      type: "text",
      id: "supporting",
      content: "Trade show booths • Canopy tents • Event displays",
      left: 260,
      top: 288,
      fill: sampleBrandColors.teal,
      fontSize: 22,
      fontFamily: "system-ui, -apple-system, sans-serif",
      width: 700,
      textLayout: "textbox",
    },
    {
      type: "text",
      id: "website",
      content: "expoprint.io",
      left: 260,
      top: 508,
      fill: sampleBrandColors.white,
      fontSize: 28,
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontWeight: "500",
    },
  ],
};
