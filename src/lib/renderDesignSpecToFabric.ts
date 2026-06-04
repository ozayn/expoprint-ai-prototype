import type { Canvas, FabricObject } from "fabric";
import type {
  BackgroundLayer,
  DesignLayer,
  DesignSpec,
  ImageLayer,
  ImagePlaceholderLayer,
  PolygonLayer,
  RectLayer,
  SocialFooterItemLayer,
  SpecOriginX,
  SpecOriginY,
  TextLayer,
} from "./designSpec";
import {
  isLogoCanvasDebugEnabled,
  logLogoRenderFit,
} from "@/lib/logoCanvasDebug";
import {
  decideTransparentPaddingTrim,
  fabricImageElement,
  measureVisibleContentBounds,
  type VisibleContentBounds,
} from "@/lib/logoVisibleBounds";
import { SOCIAL_PLATFORM_MARKS } from "./socialPlatformDisplay";

export type FabricModule = typeof import("fabric");

/**
 * Per-canvas generation counter for async image loads. If the user re-renders
 * the canvas while an image is still loading, the resolved image is dropped
 * instead of leaking onto a stale spec. Stored as a non-enumerable property
 * so it doesn't pollute `toJSON()`.
 */
type CanvasWithGen = Canvas & { __renderGen?: number };

function bumpRenderGen(canvas: Canvas): number {
  const c = canvas as CanvasWithGen;
  const next = (c.__renderGen ?? 0) + 1;
  c.__renderGen = next;
  return next;
}

function currentRenderGen(canvas: Canvas): number {
  const c = canvas as CanvasWithGen;
  return c.__renderGen ?? 0;
}

function layerOrigin(layer: { originX?: SpecOriginX; originY?: SpecOriginY }): {
  originX: SpecOriginX;
  originY: SpecOriginY;
} {
  return {
    originX: layer.originX ?? "left",
    originY: layer.originY ?? "top",
  };
}

function applyLayerId(target: { set: (key: string, value: unknown) => void }, id?: string) {
  if (id) {
    target.set("name", id);
  }
}

function renderBackground(
  fabric: FabricModule,
  canvas: DesignSpec["canvas"],
  layer: BackgroundLayer,
) {
  const { Rect } = fabric;
  const rect = new Rect({
    left: 0,
    top: 0,
    width: canvas.width,
    height: canvas.height,
    fill: layer.fill,
    strokeWidth: 0,
    originX: "left",
    originY: "top",
  });
  applyLayerId(rect, layer.id);
  return rect;
}

function renderRect(fabric: FabricModule, layer: RectLayer) {
  const { Rect } = fabric;
  const rect = new Rect({
    ...layerOrigin(layer),
    left: layer.left,
    top: layer.top,
    width: layer.width,
    height: layer.height,
    fill: layer.fill,
    stroke: layer.stroke,
    strokeWidth: layer.strokeWidth ?? 0,
    strokeDashArray: layer.strokeDashArray,
  });
  applyLayerId(rect, layer.id);
  return rect;
}

function renderPolygon(fabric: FabricModule, layer: PolygonLayer) {
  const { Polygon } = fabric;
  const poly = new Polygon(layer.points, {
    ...layerOrigin(layer),
    left: layer.left,
    top: layer.top,
    fill: layer.fill,
    opacity: layer.opacity,
    strokeWidth: layer.strokeWidth ?? 0,
    angle: layer.angle ?? 0,
  });
  applyLayerId(poly, layer.id);
  return poly;
}

function renderText(fabric: FabricModule, layer: TextLayer) {
  const { IText, Textbox } = fabric;
  /** Fabric 7 may call string helpers on options; never pass `undefined` for text props. */
  const content = layer.content == null ? "" : String(layer.content);
  const fontFamily =
    typeof layer.fontFamily === "string" && layer.fontFamily.length > 0
      ? layer.fontFamily
      : "sans-serif";
  const fill =
    typeof layer.fill === "string" && layer.fill.length > 0
      ? layer.fill
      : "#000000";
  const fontSize =
    typeof layer.fontSize === "number" && Number.isFinite(layer.fontSize)
      ? layer.fontSize
      : 16;

  const base = {
    ...layerOrigin(layer),
    left: layer.left,
    top: layer.top,
    fill,
    fontSize,
    fontFamily,
  };

  const width =
    typeof layer.width === "number" && Number.isFinite(layer.width) && layer.width > 0
      ? layer.width
      : undefined;

  const useTextbox = layer.textLayout === "textbox" && width !== undefined;

  const textOptions = {
    ...base,
    ...(layer.fontWeight !== undefined ? { fontWeight: layer.fontWeight } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(layer.opacity !== undefined ? { opacity: layer.opacity } : {}),
    ...(layer.textAlign !== undefined ? { textAlign: layer.textAlign } : {}),
    ...(layer.lineHeight !== undefined ? { lineHeight: layer.lineHeight } : {}),
  };

  const text = useTextbox
    ? new Textbox(content, textOptions)
    : new IText(content, textOptions);
  applyLayerId(text, layer.id);
  return text;
}

function hexFillWithAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(255,255,255,${alpha})`;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function renderSocialFooterItem(fabric: FabricModule, layer: SocialFooterItemLayer) {
  const { Group, IText, Rect } = fabric;
  const iconSize = layer.iconSize ?? 14;
  const fontSize = layer.fontSize ?? 14;
  const gap = 6;
  const mark =
    layer.platformMark?.trim() ||
    SOCIAL_PLATFORM_MARKS[layer.platform] ||
    "?";
  const labelContent =
    layer.labelText?.trim() ||
    layer.displayText.replace(/^\S+\s+/, "").trim() ||
    layer.displayText;

  const badge = new Rect({
    left: 0,
    top: 0,
    width: iconSize,
    height: iconSize,
    rx: Math.max(2, Math.round(iconSize * 0.22)),
    ry: Math.max(2, Math.round(iconSize * 0.22)),
    fill: hexFillWithAlpha(layer.fill, 0.14),
    stroke: layer.fill,
    strokeWidth: 0.75,
    originX: "left",
    originY: "top",
  });

  const markFontSize =
    mark.length > 1 ? Math.max(9, fontSize * 0.72) : Math.max(10, fontSize * 0.82);
  const markText = new IText(mark, {
    left: iconSize / 2,
    top: iconSize / 2,
    fontSize: markFontSize,
    fontFamily: layer.fontFamily,
    fill: layer.fill,
    fontWeight: "700",
    textAlign: "center",
    originX: "center",
    originY: "center",
  });

  const label = new IText(labelContent, {
    left: iconSize + gap,
    top: Math.max(0, (iconSize - fontSize) / 2),
    fontSize,
    fontFamily: layer.fontFamily,
    fill: layer.fill,
    ...(layer.fontWeight !== undefined ? { fontWeight: layer.fontWeight } : {}),
    originX: "left",
    originY: "top",
  });

  const group = new Group([badge, markText, label], {
    left: layer.left,
    top: layer.top,
    originX: "left",
    originY: "top",
    ...(layer.opacity !== undefined ? { opacity: layer.opacity } : {}),
  });
  applyLayerId(group, layer.id);
  return group;
}

function renderImagePlaceholder(fabric: FabricModule, layer: ImagePlaceholderLayer) {
  const { Rect } = fabric;
  const rect = new Rect({
    ...layerOrigin(layer),
    left: layer.left,
    top: layer.top,
    width: layer.width,
    height: layer.height,
    fill: layer.fill,
    stroke: layer.stroke,
    strokeWidth: layer.strokeWidth,
    strokeDashArray: layer.strokeDashArray,
  });
  applyLayerId(rect, layer.id);
  return rect;
}

function fabricObjectForLayer(
  fabric: FabricModule,
  spec: DesignSpec,
  layer: Exclude<DesignLayer, ImageLayer>,
) {
  switch (layer.type) {
    case "background":
      return renderBackground(fabric, spec.canvas, layer);
    case "rect":
      return renderRect(fabric, layer);
    case "polygon":
      return renderPolygon(fabric, layer);
    case "text":
      return renderText(fabric, layer);
    case "socialFooterItem":
      return renderSocialFooterItem(fabric, layer);
    case "imagePlaceholder":
      return renderImagePlaceholder(fabric, layer);
    default: {
      const _exhaustive: never = layer;
      return _exhaustive;
    }
  }
}

const DEFAULT_LOGO_BOX_PADDING = 15;
/** Compact marks: cap rendered size inside the logo zone (px). */
const ICON_MAX_RENDERED_PX = 68;
const ICON_MIN_RENDERED_PX = 32;
const WORDMARK_MIN_RENDERED_HEIGHT_PX = 24;

const COMPACT_PRIMARY_LOGO_PATH_RE =
  /shopify-logo-primary-logo|logo-primary-logo|primary-logo|primary_logo|full-logo|horizontal-logo/i;

type LogoFitMode = "wordmark" | "icon" | "contain";

function logoLayerUrlBlob(layer: ImageLayer): string {
  const parts = [layer.logoRemoteUrl ?? "", layer.src];
  try {
    return decodeURIComponent(parts.join(" ")).toLowerCase();
  } catch {
    return parts.join(" ").toLowerCase();
  }
}

function isCompactPrimaryLogoLayer(layer: ImageLayer): boolean {
  if (layer.fitHint === "wordmark" || layer.fitHint === "contain") return false;
  if (layer.logoRole === "wordmark") return false;
  if (
    layer.logoSource === "header-image" ||
    layer.logoSource === "img-logo"
  ) {
    return layer.fitHint === "icon";
  }
  if (layer.fitHint === "icon") return true;
  if (typeof layer.logoMaxRenderedPx === "number") return true;
  return COMPACT_PRIMARY_LOGO_PATH_RE.test(logoLayerUrlBlob(layer));
}

function isSquareishAspect(natW: number, natH: number): boolean {
  const ratio = natW / natH;
  return ratio >= 0.82 && ratio <= 1.22;
}

function isWideWordmarkAspect(natW: number, natH: number): boolean {
  return natW / natH >= 1.55;
}

function resolveLogoFitMode(
  layer: ImageLayer,
  natW: number,
  natH: number,
): LogoFitMode {
  if (isCompactPrimaryLogoLayer(layer)) return "icon";

  const hint = layer.fitHint ?? "contain";
  const role = layer.logoRole;

  if (hint === "icon") return "icon";
  if (role === "icon_mark" || role === "fallback_icon") return "icon";
  if (role === "marketing_image" || role === "social_preview") return "icon";

  if (hint === "wordmark" || role === "wordmark") {
    return isWideWordmarkAspect(natW, natH) ? "wordmark" : "contain";
  }

  if (
    layer.logoSource === "header-image" ||
    layer.logoSource === "img-logo"
  ) {
    if (isSquareishAspect(natW, natH)) return "icon";
    return isWideWordmarkAspect(natW, natH) ? "wordmark" : "contain";
  }

  if (role === "unknown") {
    if (isSquareishAspect(natW, natH)) return "icon";
    if (isWideWordmarkAspect(natW, natH)) return "wordmark";
    return "contain";
  }

  if (isSquareishAspect(natW, natH)) return "icon";

  if (natW / natH > 2.4) {
    return isWideWordmarkAspect(natW, natH) ? "wordmark" : "contain";
  }

  return "contain";
}

function iconBoxFraction(layer: ImageLayer): number {
  if (isCompactPrimaryLogoLayer(layer)) return 0.52;
  if (
    layer.logoRole === "fallback_icon" ||
    layer.logoRole === "marketing_image" ||
    layer.logoRole === "social_preview"
  ) {
    return 0.5;
  }
  return 0.58;
}

function iconMaxRenderedPx(layer: ImageLayer): number {
  if (typeof layer.logoMaxRenderedPx === "number" && layer.logoMaxRenderedPx > 0) {
    return layer.logoMaxRenderedPx;
  }
  if (COMPACT_PRIMARY_LOGO_PATH_RE.test(logoLayerUrlBlob(layer))) {
    return 64;
  }
  return ICON_MAX_RENDERED_PX;
}

type FabricImageLike = FabricObject & {
  getOriginalSize?: () => { width: number; height: number };
  width?: number;
  height?: number;
  setCoords?: () => void;
};

/**
 * Object-contain fit: full image visible inside the logo box with padding, centered.
 * Uses natural pixel dimensions so wide SVG wordmarks are not over-scaled/cropped.
 */
function fitImageContainInLayerBox(img: FabricImageLike, layer: ImageLayer): boolean {
  const padding = Math.min(
    18,
    Math.max(12, typeof layer.padding === "number" ? layer.padding : DEFAULT_LOGO_BOX_PADDING),
  );
  const boxW = Math.max(1, layer.width - padding * 2);
  const boxH = Math.max(1, layer.height - padding * 2);

  const natural =
    typeof img.getOriginalSize === "function"
      ? img.getOriginalSize()
      : { width: img.width ?? 0, height: img.height ?? 0 };
  let natW = natural.width;
  let natH = natural.height;
  if (!Number.isFinite(natW) || !Number.isFinite(natH) || natW <= 0 || natH <= 0) {
    return false;
  }

  const element = fabricImageElement(img);
  const visibleBounds = measureVisibleContentBounds(element);
  const trimDecision = decideTransparentPaddingTrim(visibleBounds, layer, {
    forceDisable: isLogoCanvasDebugEnabled(),
  });
  const trimmed = trimDecision.trim;
  if (trimmed && visibleBounds) {
    natW = visibleBounds.width;
    natH = visibleBounds.height;
    img.set({
      cropX: visibleBounds.x,
      cropY: visibleBounds.y,
      width: visibleBounds.width,
      height: visibleBounds.height,
    });
  } else {
    img.set({
      cropX: 0,
      cropY: 0,
      width: natW,
      height: natH,
    });
  }

  let scale = Math.min(boxW / natW, boxH / natH);
  const fitMode = resolveLogoFitMode(layer, natW, natH);

  if (fitMode === "wordmark") {
    /** Wide marks: prioritize readable width; height letterboxes inside the box. */
    scale = Math.min(scale, boxW / natW);
    const maxWordmarkHeight = boxH * 0.88;
    scale = Math.min(scale, maxWordmarkHeight / natH);
  }

  if (fitMode === "icon") {
    /** Compact / square marks: stay centered without filling the whole logo zone. */
    const maxByBox = Math.min(boxW, boxH) * iconBoxFraction(layer);
    const maxByPx = iconMaxRenderedPx(layer);
    const maxIconDim = Math.min(maxByBox, maxByPx);
    scale = Math.min(scale, maxIconDim / Math.max(natW, natH));
  }

  /** Never exceed the inner logo box. */
  scale = Math.min(scale, boxW / natW, boxH / natH);

  const renderedMin = Math.min(natW * scale, natH * scale);
  if (fitMode !== "icon" && renderedMin < ICON_MIN_RENDERED_PX) {
    const boost = ICON_MIN_RENDERED_PX / Math.min(natW, natH);
    scale = Math.min(Math.max(scale, boost), boxW / natW, boxH / natH);
  }

  if (fitMode === "wordmark") {
    const renderedH = natH * scale;
    if (renderedH < WORDMARK_MIN_RENDERED_HEIGHT_PX) {
      const boost = WORDMARK_MIN_RENDERED_HEIGHT_PX / natH;
      scale = Math.min(Math.max(scale, boost), boxW / natW, boxH / natH);
    }
  }

  const centerX = layer.left + layer.width / 2;
  const centerY = layer.top + layer.height / 2;

  img.set({
    originX: "center",
    originY: "center",
    left: centerX,
    top: centerY,
    scaleX: scale,
    scaleY: scale,
    ...(typeof layer.opacity === "number" ? { opacity: layer.opacity } : {}),
  });
  img.setCoords?.();

  if (process.env.NODE_ENV === "development" && layer.id === "logo-image") {
    logLogoRenderFit({
      layerId: layer.id,
      fitMode,
      naturalWidth: natural.width,
      naturalHeight: natural.height,
      visibleBounds,
      trimDecision,
      scaleX: scale,
      scaleY: scale,
      renderedWidth: natW * scale,
      renderedHeight: natH * scale,
      fabricLeft: centerX,
      fabricTop: centerY,
      fabricObjectWidth: img.width,
      fabricObjectHeight: img.height,
      box: { left: layer.left, top: layer.top, width: layer.width, height: layer.height },
    });
  }

  return true;
}

function addLogoDebugOverlays(
  canvas: Canvas,
  fabric: FabricModule,
  layer: ImageLayer,
  img: FabricImageLike,
  visibleBounds: VisibleContentBounds | null,
  trimmed: boolean,
): void {
  if (!isLogoCanvasDebugEnabled() || layer.id !== "logo-image") return;

  const { Rect } = fabric;

  const boxRect = new Rect({
    left: layer.left,
    top: layer.top,
    width: layer.width,
    height: layer.height,
    fill: "transparent",
    stroke: "#ef4444",
    strokeWidth: 2,
    strokeDashArray: [6, 4],
    selectable: false,
    evented: false,
    originX: "left",
    originY: "top",
  });
  applyLayerId(boxRect, "logo-debug-box");
  canvas.add(boxRect);

  if (trimmed && visibleBounds && typeof img.scaleX === "number") {
    const scale = img.scaleX;
    const cropLeft = layer.left + layer.width / 2 - (visibleBounds.width * scale) / 2;
    const cropTop = layer.top + layer.height / 2 - (visibleBounds.height * scale) / 2;
    const cropRect = new Rect({
      left: cropLeft,
      top: cropTop,
      width: visibleBounds.width * scale,
      height: visibleBounds.height * scale,
      fill: "transparent",
      stroke: "#22c55e",
      strokeWidth: 2,
      strokeDashArray: [4, 3],
      selectable: false,
      evented: false,
      originX: "left",
      originY: "top",
    });
    applyLayerId(cropRect, "logo-debug-crop");
    canvas.add(cropRect);
  }
}

/**
 * Loads an image asynchronously via `FabricImage.fromURL` with `crossOrigin: "anonymous"`
 * (paired with the `/api/proxy-image` route's permissive CORS so PNG export stays untainted).
 * On success: scales the image into the logo box with object-contain (no crop), centered with
 * padding, removes placeholder layers on load, and adds the image to the canvas.
 *
 * Tagged with the canvas render generation so a stale image cannot leak into a newer spec.
 */
function scheduleImageLoad(
  canvas: Canvas,
  fabric: FabricModule,
  layer: ImageLayer,
  generation: number,
): void {
  /**
   * `FabricImage.fromURL` returns a Promise. Errors here include CORS-tainted
   * loads (the canvas would refuse to export PNG) or 4xx from the proxy.
   */
  fabric.FabricImage.fromURL(layer.src, { crossOrigin: "anonymous" })
    .then((img) => {
      if (currentRenderGen(canvas) !== generation) return;
      if (!fitImageContainInLayerBox(img, layer)) {
        return;
      }
      applyLayerId(img, layer.id);

      /** Remove placeholder + any label layers only on confirmed load. */
      if (layer.replacePlaceholderIds && layer.replacePlaceholderIds.length) {
        const ids = new Set(layer.replacePlaceholderIds);
        for (const obj of canvas.getObjects().slice()) {
          const objWithName = obj as FabricObject & { name?: unknown };
          const name = objWithName.name;
          if (typeof name === "string" && ids.has(name)) {
            canvas.remove(obj);
          }
        }
      }

      canvas.add(img);

      const element = fabricImageElement(img);
      const bounds = measureVisibleContentBounds(element);
      const trimmed = decideTransparentPaddingTrim(bounds, layer, {
        forceDisable: isLogoCanvasDebugEnabled(),
      }).trim;
      addLogoDebugOverlays(canvas, fabric, layer, img, bounds, trimmed);

      canvas.requestRenderAll();
    })
    .catch(() => {
      /** Leave placeholders intact on failure. No canvas mutation. */
    });
}

/**
 * Clears the canvas, applies spec dimensions, and builds editable Fabric objects from the spec.
 *
 * Synchronous layers (background/shapes/text/image placeholder) are added first so the canvas
 * has visible content immediately. `image` layers are scheduled asynchronously and only replace
 * their placeholders when the load actually succeeds — see {@link scheduleImageLoad}.
 */
export function renderDesignSpecToFabric(
  canvas: Canvas,
  fabric: FabricModule,
  spec: DesignSpec,
): void {
  canvas.clear();
  canvas.setDimensions({
    width: spec.canvas.width,
    height: spec.canvas.height,
  });
  const generation = bumpRenderGen(canvas);

  const deferredImages: ImageLayer[] = [];
  for (const layer of spec.layers) {
    if (layer.type === "image") {
      deferredImages.push(layer);
      continue;
    }
    const obj = fabricObjectForLayer(fabric, spec, layer);
    canvas.add(obj);
  }

  canvas.renderAll();

  for (const imageLayer of deferredImages) {
    scheduleImageLoad(canvas, fabric, imageLayer, generation);
  }
}
