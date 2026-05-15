import type { Canvas } from "fabric";
import type {
  BackgroundLayer,
  DesignLayer,
  DesignSpec,
  ImagePlaceholderLayer,
  PolygonLayer,
  RectLayer,
  SpecOriginX,
  SpecOriginY,
  TextLayer,
} from "./designSpec";

export type FabricModule = typeof import("fabric");

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
  };

  const text = useTextbox
    ? new Textbox(content, textOptions)
    : new IText(content, textOptions);
  applyLayerId(text, layer.id);
  return text;
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
  layer: DesignLayer,
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
    case "imagePlaceholder":
      return renderImagePlaceholder(fabric, layer);
    default: {
      const _exhaustive: never = layer;
      return _exhaustive;
    }
  }
}

/**
 * Clears the canvas, applies spec dimensions, and builds editable Fabric objects from the spec.
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

  for (const layer of spec.layers) {
    const obj = fabricObjectForLayer(fabric, spec, layer);
    canvas.add(obj);
  }

  canvas.renderAll();
}
