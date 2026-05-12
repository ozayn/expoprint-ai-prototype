import type { Canvas } from "fabric";
import type {
  BackgroundLayer,
  DesignLayer,
  DesignSpec,
  ImagePlaceholderLayer,
  PolygonLayer,
  RectLayer,
  TextLayer,
} from "./designSpec";

export type FabricModule = typeof import("fabric");

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
  });
  applyLayerId(rect, layer.id);
  return rect;
}

function renderRect(fabric: FabricModule, layer: RectLayer) {
  const { Rect } = fabric;
  const rect = new Rect({
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
    left: layer.left,
    top: layer.top,
    fill: layer.fill,
    opacity: layer.opacity,
    strokeWidth: layer.strokeWidth ?? 0,
  });
  applyLayerId(poly, layer.id);
  return poly;
}

function renderText(fabric: FabricModule, layer: TextLayer) {
  const { IText } = fabric;
  const text = new IText(layer.content, {
    left: layer.left,
    top: layer.top,
    fill: layer.fill,
    fontSize: layer.fontSize,
    fontFamily: layer.fontFamily,
    fontWeight: layer.fontWeight,
    width: layer.width,
    opacity: layer.opacity,
  });
  applyLayerId(text, layer.id);
  return text;
}

function renderImagePlaceholder(fabric: FabricModule, layer: ImagePlaceholderLayer) {
  const { Rect } = fabric;
  const rect = new Rect({
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
