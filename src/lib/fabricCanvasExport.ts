import type { Canvas } from "fabric";

export function triggerDownload(data: string, filename: string, mime: string) {
  const a = document.createElement("a");
  a.href = data;
  a.download = filename;
  a.setAttribute("type", mime);
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Download the current Fabric canvas at 1× artboard resolution (PNG). */
export function exportFabricCanvasPng(
  canvas: Canvas,
  filename = "expoprint-concept.png",
): void {
  const dataUrl = canvas.toDataURL({ format: "png", multiplier: 1 });
  triggerDownload(dataUrl, filename, "image/png");
}
