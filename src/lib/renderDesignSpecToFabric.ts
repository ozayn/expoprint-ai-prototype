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
import { SOCIAL_ICON_PATHS } from "./socialPlatformDisplay";

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

function renderSocialFooterItem(fabric: FabricModule, layer: SocialFooterItemLayer) {
  const { Group, IText, Path } = fabric;
  const iconSize = layer.iconSize ?? 14;
  const fontSize = layer.fontSize ?? 14;
  const scale = iconSize / 24;
  const pathData = SOCIAL_ICON_PATHS[layer.platform];
  const icon = new Path(pathData, {
    left: 0,
    top: 0,
    scaleX: scale,
    scaleY: scale,
    fill: layer.fill,
    strokeWidth: 0,
    originX: "left",
    originY: "top",
  });
  const label = new IText(layer.displayText, {
    left: iconSize + 6,
    top: Math.max(0, (iconSize - fontSize) / 2),
    fontSize,
    fontFamily: layer.fontFamily,
    fill: layer.fill,
    ...(layer.fontWeight !== undefined ? { fontWeight: layer.fontWeight } : {}),
    originX: "left",
    originY: "top",
  });
  const group = new Group([icon, label], {
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

/**
 * Loads an image asynchronously via `FabricImage.fromURL` with `crossOrigin: "anonymous"`
 * (paired with the `/api/proxy-image` route's permissive CORS so PNG export stays untainted).
 * On success: scales the image into `[layer.left..layer.left+width, layer.top..layer.top+height]`
 * preserving aspect ratio, removes any sibling layers listed in `replacePlaceholderIds`, and adds
 * the image to the canvas. On error: leaves placeholders in place — caller already added them.
 *
 * Tagged with the canvas render generation so a stale image cannot leak into a newer spec.
 */
function scheduleImageLoad(
  canvas: Canvas,
  fabric: FabricModule,
  layer: ImageLayer,
  generation: number,
): void {
  const padding = typeof layer.padding === "number" ? layer.padding : 8;
  const boxW = Math.max(1, layer.width - padding * 2);
  const boxH = Math.max(1, layer.height - padding * 2);

  /**
   * `FabricImage.fromURL` returns a Promise. Errors here include CORS-tainted
   * loads (the canvas would refuse to export PNG) or 4xx from the proxy.
   */
  fabric.FabricImage.fromURL(layer.src, { crossOrigin: "anonymous" })
    .then((img) => {
      if (currentRenderGen(canvas) !== generation) return;
      const w = img.width ?? 0;
      const h = img.height ?? 0;
      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
        return;
      }
      const scale = Math.min(boxW / w, boxH / h);
      const drawnW = w * scale;
      const drawnH = h * scale;
      img.set({
        left: layer.left + (layer.width - drawnW) / 2,
        top: layer.top + (layer.height - drawnH) / 2,
        scaleX: scale,
        scaleY: scale,
        originX: "left",
        originY: "top",
        ...(typeof layer.opacity === "number" ? { opacity: layer.opacity } : {}),
      });
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
