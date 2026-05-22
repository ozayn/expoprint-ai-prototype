"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Canvas } from "fabric";
import { ExportPngButton } from "@/components/ExportPngButton";
import {
  createDesignSpecFromIntake,
  shouldUseIntakeDesignSpec,
} from "@/lib/createDesignSpecFromIntake";
import type { DesignIntakeState } from "@/lib/designIntakeState";
import { sampleDesignSpec } from "@/lib/designSpec";
import { buildConceptExportFilename } from "@/lib/exportConceptFilename";
import { exportFabricCanvasPng } from "@/lib/fabricCanvasExport";
import { renderDesignSpecToFabric } from "@/lib/renderDesignSpecToFabric";

const { width: CANVAS_W, height: CANVAS_H } = sampleDesignSpec.canvas;

type CanvasPhase = "initializing" | "ready" | "error";

export type FabricPreviewCanvasProps = {
  intake: DesignIntakeState;
  surfaceLabel: string | null;
  /** Bump when a new API run should dispose and recreate the Fabric canvas. */
  sessionKey: string | number;
};

export function FabricPreviewCanvas({
  intake,
  surfaceLabel,
  sessionKey,
}: FabricPreviewCanvasProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const previewSlotRef = useRef<HTMLDivElement>(null);
  const intakeRef = useRef(intake);
  const surfaceRef = useRef(surfaceLabel);
  const renderRunIdRef = useRef(0);

  const [phase, setPhase] = useState<CanvasPhase>("initializing");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useLayoutEffect(() => {
    intakeRef.current = intake;
    surfaceRef.current = surfaceLabel;
  }, [intake, surfaceLabel]);

  const syncCanvasPreviewCss = useCallback(() => {
    const canvas = fabricRef.current;
    const slot = previewSlotRef.current;
    if (!canvas || !slot) return;
    const slotW = slot.clientWidth;
    if (slotW <= 0) return;
    const horizontalGutter = slotW < 400 ? 20 : slotW < 640 ? 28 : 40;
    const scale = Math.min(
      1,
      Math.max(0.15, (slotW - horizontalGutter) / CANVAS_W),
    );
    const cssW = Math.max(1, Math.round(CANVAS_W * scale));
    const cssH = Math.max(1, Math.round(CANVAS_H * scale));
    canvas.setDimensions(
      { width: `${cssW}px`, height: `${cssH}px` },
      { cssOnly: true },
    );

    type CanvasWithContainer = Canvas & {
      elements?: { container?: HTMLDivElement };
    };
    const container = (canvas as CanvasWithContainer).elements?.container;
    if (container) {
      container.style.width = `${cssW}px`;
      container.style.maxWidth = "100%";
      container.style.boxSizing = "border-box";
      container.style.marginLeft = "auto";
      container.style.marginRight = "auto";
    }

    canvas.calcOffset();
    canvas.requestRenderAll();
  }, []);

  const renderFromIntake = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const runId = ++renderRunIdRef.current;
    void import("fabric")
      .then((fabric) => {
        if (runId !== renderRunIdRef.current) return;
        const latest = intakeRef.current;
        const spec = shouldUseIntakeDesignSpec(latest)
          ? createDesignSpecFromIntake(latest, surfaceRef.current)
          : sampleDesignSpec;
        renderDesignSpecToFabric(canvas, fabric, spec);
        queueMicrotask(() => syncCanvasPreviewCss());
      })
      .catch((err) => {
        console.error("Fabric preview render failed:", err);
        setPhase("error");
        setErrorDetail(
          err instanceof Error ? err.message : "Could not load Fabric module.",
        );
      });
  }, [syncCanvasPreviewCss]);

  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) return;

    let cancelled = false;
    let canvas: Canvas | null = null;
    setPhase("initializing");
    setErrorDetail(null);

    void import("fabric")
      .then((fabric) => {
        if (cancelled) return;
        try {
          canvas = new fabric.Canvas(el, {
            width: CANVAS_W,
            height: CANVAS_H,
            preserveObjectStacking: true,
          });
        } catch (err) {
          setPhase("error");
          setErrorDetail(err instanceof Error ? err.message : String(err));
          return;
        }
        if (cancelled) {
          canvas.dispose();
          return;
        }
        fabricRef.current = canvas;
        setPhase("ready");
        queueMicrotask(() => renderFromIntake());
      })
      .catch((err) => {
        if (!cancelled) {
          setPhase("error");
          setErrorDetail(err instanceof Error ? err.message : String(err));
        }
      });

    return () => {
      cancelled = true;
      renderRunIdRef.current += 1;
      canvas?.dispose();
      fabricRef.current = null;
    };
  }, [sessionKey, renderFromIntake]);

  useEffect(() => {
    if (phase !== "ready") return;
    renderFromIntake();
  }, [intake, surfaceLabel, phase, renderFromIntake]);

  useLayoutEffect(() => {
    if (phase !== "ready") return;
    const slot = previewSlotRef.current;
    const canvas = fabricRef.current;
    if (!slot || !canvas) return;

    const ro = new ResizeObserver(() => syncCanvasPreviewCss());
    ro.observe(slot);
    syncCanvasPreviewCss();
    const raf = requestAnimationFrame(() => syncCanvasPreviewCss());
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [phase, syncCanvasPreviewCss]);

  const exportPng = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const latest = intakeRef.current;
    exportFabricCanvasPng(
      canvas,
      buildConceptExportFilename({
        businessName: latest.businessName,
        surfaceLabel: surfaceRef.current,
        productCategory: latest.category,
        extension: "png",
      }),
    );
  }, []);

  const ready = phase === "ready";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">
          {phase === "initializing"
            ? "Canvas preview: initializing…"
            : phase === "error"
              ? `Canvas preview: error${errorDetail ? ` — ${errorDetail}` : ""}`
              : "1000×600 artboard · scaled preview"}
        </p>
        <ExportPngButton disabled={!ready} onClick={exportPng} />
      </div>
      <div
        ref={previewSlotRef}
        className="mt-3 w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 p-2 ring-1 ring-zinc-200/60"
      >
        <canvas ref={canvasElRef} aria-label="Design concept canvas preview" />
      </div>
    </div>
  );
}
