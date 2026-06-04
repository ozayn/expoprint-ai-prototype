import type { ImageLayer } from "@/lib/designSpec";
import type { TrimDecision, VisibleContentBounds } from "@/lib/logoVisibleBounds";

export type LogoCanvasDebugPayload = {
  selectedLogoCandidateUrl: string;
  logoRemoteUrl: string;
  proxiedSrc: string;
  sidebarThumbnailUrl: string;
  logoSource?: string;
  logoRole?: string;
  fitHint?: string;
  logoMaxRenderedPx?: number;
  candidateWidth?: number;
  candidateHeight?: number;
  autoSelected?: boolean;
  box: { left: number; top: number; width: number; height: number; padding?: number };
};

/** Dev-only: `NEXT_PUBLIC_LOGO_CANVAS_DEBUG=1` or `localStorage.expoprint.logoDebug=1`. */
export function isLogoCanvasDebugEnabled(): boolean {
  if (process.env.NODE_ENV !== "development") return false;
  if (process.env.NEXT_PUBLIC_LOGO_CANVAS_DEBUG === "1") return true;
  if (typeof window !== "undefined") {
    try {
      return window.localStorage.getItem("expoprint.logoDebug") === "1";
    } catch {
      return false;
    }
  }
  return false;
}

export function logLogoCanvasSelection(payload: LogoCanvasDebugPayload): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[logo-canvas] selection", {
    ...payload,
    note: "Sidebar uses logoRemoteUrl directly; Fabric uses proxiedSrc (same asset via /api/proxy-image).",
  });
}

export type LogoRenderDebugPayload = {
  layerId?: string;
  fitMode: string;
  naturalWidth: number;
  naturalHeight: number;
  visibleBounds: VisibleContentBounds | null;
  trimDecision: TrimDecision;
  scaleX: number;
  scaleY: number;
  renderedWidth: number;
  renderedHeight: number;
  fabricLeft: number;
  fabricTop: number;
  fabricObjectWidth?: number;
  fabricObjectHeight?: number;
  box: { left: number; top: number; width: number; height: number };
};

export function logLogoRenderFit(payload: LogoRenderDebugPayload): void {
  if (process.env.NODE_ENV !== "development") return;
  const b = payload.visibleBounds;
  console.info("[logo-canvas] fabric fit", {
    ...payload,
    cropBounds: b
      ? {
          left: b.x,
          top: b.y,
          right: b.right,
          bottom: b.bottom,
          width: b.width,
          height: b.height,
          fullWidth: b.fullWidth,
          fullHeight: b.fullHeight,
          fillRatio: b.fillRatio,
        }
      : null,
  });
}

export function layerBoxFromImageLayer(layer: ImageLayer) {
  return {
    left: layer.left,
    top: layer.top,
    width: layer.width,
    height: layer.height,
    padding: layer.padding,
  };
}
