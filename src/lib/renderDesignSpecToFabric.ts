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
  const natW = natural.width;
  const natH = natural.height;
  if (!Number.isFinite(natW) || !Number.isFinite(natH) || natW <= 0 || natH <= 0) {
    return false;
  }

  let scale = Math.min(boxW / natW, boxH / natH);
  const fitHint = layer.fitHint ?? "contain";

  if (fitHint === "wordmark" || natW / natH > 2.4) {
    /** Wide marks: never exceed inner width (height may letterbox). */
    scale = Math.min(scale, boxW / natW);
  }

  if (fitHint === "icon") {
    /** Compact icon/favicon marks: stay centered without filling the whole box. */
    const maxIconDim = Math.min(boxW, boxH) * 0.88;
    const maxScale = maxIconDim / Math.max(natW, natH);
    scale = Math.min(scale, maxScale);
  }

  const centerX = layer.left + layer.width / 2;
  const centerY = layer.top + layer.height / 2;

  img.set({
    cropX: 0,
    cropY: 0,
    originX: "center",
    originY: "center",
    left: centerX,
    top: centerY,
    scaleX: scale,
    scaleY: scale,
    ...(typeof layer.opacity === "number" ? { opacity: layer.opacity } : {}),
  });
  img.setCoords?.();
  return true;
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
