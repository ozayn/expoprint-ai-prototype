import type { ImageLayer } from "@/lib/designSpec";

/** Alpha threshold (0–255) — transparent padding only; never brightness. */
const ALPHA_THRESHOLD = 10;
/** Downscale large assets before scanning to keep layout responsive. */
const MAX_ANALYSIS_EDGE = 900;
/** Trim only when ink fills less than this fraction of the full bitmap. */
const LOW_FILL_RATIO = 0.12;

export type VisibleContentBounds = {
  fullWidth: number;
  fullHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  fillRatio: number;
};

export type TrimDecision = {
  trim: boolean;
  reason: string;
};

function fullDimensions(source: CanvasImageSource): { w: number; h: number } | null {
  if (source instanceof HTMLImageElement) {
    const w = source.naturalWidth;
    const h = source.naturalHeight;
    return w > 0 && h > 0 ? { w, h } : null;
  }
  if (source instanceof HTMLVideoElement) {
    const w = source.videoWidth;
    const h = source.videoHeight;
    return w > 0 && h > 0 ? { w, h } : null;
  }
  if (source instanceof HTMLCanvasElement) {
    return source.width > 0 && source.height > 0
      ? { w: source.width, h: source.height }
      : null;
  }
  return null;
}

/**
 * Scan alpha channel only to find bounding box of non-transparent pixels.
 * Does not use brightness/color — safe for logos on white UI backgrounds in the file.
 */
export function measureVisibleContentBounds(
  source: CanvasImageSource | null | undefined,
): VisibleContentBounds | null {
  if (!source || typeof document === "undefined") return null;

  const full = fullDimensions(source);
  if (!full) return null;

  const { w: fullW, h: fullH } = full;
  const scale = Math.min(1, MAX_ANALYSIS_EDGE / Math.max(fullW, fullH));
  const sampleW = Math.max(1, Math.round(fullW * scale));
  const sampleH = Math.max(1, Math.round(fullH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(source, 0, 0, sampleW, sampleH);
  } catch {
    return null;
  }

  const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
  let minX = sampleW;
  let minY = sampleH;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < sampleH; y++) {
    for (let x = 0; x < sampleW; x++) {
      const alpha = data[(y * sampleW + x) * 4 + 3];
      if (alpha > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return {
      fullWidth: fullW,
      fullHeight: fullH,
      x: 0,
      y: 0,
      width: fullW,
      height: fullH,
      right: fullW,
      bottom: fullH,
      fillRatio: 1,
    };
  }

  const inv = 1 / scale;
  const x = Math.max(0, Math.floor(minX * inv));
  const y = Math.max(0, Math.floor(minY * inv));
  const width = Math.min(fullW - x, Math.ceil((maxX - minX + 1) * inv));
  const height = Math.min(fullH - y, Math.ceil((maxY - minY + 1) * inv));
  const fillRatio = (width * height) / (fullW * fullH);

  return {
    fullWidth: fullW,
    fullHeight: fullH,
    x,
    y,
    width: Math.max(1, width),
    height: Math.max(1, height),
    right: x + Math.max(1, width),
    bottom: y + Math.max(1, height),
    fillRatio,
  };
}

/** True when trimming transparent padding will materially improve contain-fit. */
export function shouldTrimToVisibleBounds(bounds: VisibleContentBounds): boolean {
  if (bounds.fillRatio >= LOW_FILL_RATIO) return false;
  if (bounds.width >= bounds.fullWidth * 0.92 && bounds.height >= bounds.fullHeight * 0.92) {
    return false;
  }
  return bounds.width >= 4 && bounds.height >= 4;
}

/**
 * Reject trims that keep only a left icon chunk on a wide header asset (Kirlin-style wordmarks).
 */
export function looksLikePartialHorizontalCrop(bounds: VisibleContentBounds): boolean {
  const { fullWidth, fullHeight, x, width, height } = bounds;
  const marginRight = fullWidth - (x + width);
  const marginLeft = x;
  const fullAspect = fullWidth / Math.max(1, fullHeight);
  const boundsAspect = width / Math.max(1, height);

  if (fullAspect >= 1.35 && width < fullWidth * 0.55) {
    return true;
  }

  if (
    fullAspect >= 1.25 &&
    boundsAspect < 1.25 &&
    width < fullWidth * 0.65 &&
    marginRight > fullWidth * 0.18 &&
    marginLeft < fullWidth * 0.12
  ) {
    return true;
  }

  if (fullAspect >= 1.5 && height >= fullHeight * 0.5 && width < fullWidth * 0.45) {
    return true;
  }

  return false;
}

function layerAssetUrl(layer?: Pick<ImageLayer, "logoRemoteUrl" | "src">): string {
  return `${layer?.logoRemoteUrl ?? ""} ${layer?.src ?? ""}`.toLowerCase();
}

/**
 * Decide whether to apply Fabric crop to visible alpha bounds.
 * Conservative: header/wordmark/SVG/wide assets skip trim; partial left-only crops rejected.
 */
export function decideTransparentPaddingTrim(
  bounds: VisibleContentBounds | null,
  layer?: Pick<ImageLayer, "logoSource" | "fitHint" | "logoRole" | "logoRemoteUrl" | "src">,
  options?: { forceDisable?: boolean },
): TrimDecision {
  if (options?.forceDisable) {
    return { trim: false, reason: "trim_disabled_debug" };
  }
  if (!bounds) {
    return { trim: false, reason: "no_bounds" };
  }

  if (layer?.fitHint === "wordmark" || layer?.logoRole === "wordmark") {
    return { trim: false, reason: "wordmark_role_or_hint" };
  }
  if (layer?.logoSource === "header-image" || layer?.logoSource === "img-logo") {
    return { trim: false, reason: "header_or_img_logo_source" };
  }

  const url = layerAssetUrl(layer);
  if (/\.svg(?:$|\?|#)/i.test(url)) {
    return { trim: false, reason: "svg_use_full_viewbox" };
  }

  const fullAspect = bounds.fullWidth / Math.max(1, bounds.fullHeight);
  if (fullAspect >= 1.35) {
    return { trim: false, reason: "wide_asset_preserve_full_raster" };
  }

  if (!shouldTrimToVisibleBounds(bounds)) {
    return { trim: false, reason: "fill_ratio_not_low_enough" };
  }

  if (looksLikePartialHorizontalCrop(bounds)) {
    return { trim: false, reason: "partial_horizontal_crop_rejected" };
  }

  return { trim: true, reason: "transparent_padding_only" };
}

/** @deprecated Use {@link decideTransparentPaddingTrim}. */
export function shouldTrimToVisibleBoundsForLayer(
  bounds: VisibleContentBounds | null,
  layer?: Pick<ImageLayer, "logoSource" | "fitHint" | "logoRole" | "logoRemoteUrl" | "src">,
): boolean {
  return decideTransparentPaddingTrim(bounds, layer).trim;
}

export function fabricImageElement(img: unknown): CanvasImageSource | null {
  if (!img || typeof img !== "object") return null;
  const candidate = img as {
    _element?: CanvasImageSource;
    _originalElement?: CanvasImageSource;
    getElement?: () => CanvasImageSource;
  };
  return (
    candidate.getElement?.() ??
    candidate._element ??
    candidate._originalElement ??
    null
  );
}
