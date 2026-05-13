"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Canvas } from "fabric";
import { DesignIntakePanel } from "@/components/DesignIntakePanel";
import {
  createDesignSpecFromIntake,
  shouldUseIntakeDesignSpec,
} from "@/lib/createDesignSpecFromIntake";
import { buildMockExtracted, computeDesignBriefText, defaultDesignIntake, getSelectedProductComponents, type DesignIntakeState } from "@/lib/designIntakeState";
import { sampleDesignSpec } from "@/lib/designSpec";
import { renderDesignSpecToFabric } from "@/lib/renderDesignSpecToFabric";

const { width: CANVAS_W, height: CANVAS_H } = sampleDesignSpec.canvas;

function triggerDownload(data: string, filename: string, mime: string) {
  const a = document.createElement("a");
  a.href = data;
  a.download = filename;
  a.setAttribute("type", mime);
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

type CanvasPhase = "initializing" | "ready" | "error";

function canvasStatusLabel(phase: CanvasPhase, errorDetail: string | null): string {
  if (phase === "error") {
    return `Canvas status: error: ${errorDetail ?? "Unknown error"}`;
  }
  if (phase === "ready") {
    return "Canvas status: ready";
  }
  return "Canvas status: initializing...";
}

export function FabricDesignEditor() {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Width slot for preview; backstore stays {CANVAS_W}×{CANVAS_H}px via Fabric `cssOnly` scaling. */
  const previewSlotRef = useRef<HTMLDivElement>(null);
  /** Always latest intake for async `import("fabric")` callbacks (avoids stale closures / races). */
  const intakeRef = useRef<DesignIntakeState>(defaultDesignIntake());
  /** Resolved tab for async generate (matches highlighted surface, including first paint). */
  const displaySurfaceRef = useRef<string | null>(null);
  const generateSampleRunIdRef = useRef(0);

  const [canvasPhase, setCanvasPhase] = useState<CanvasPhase>("initializing");
  const [canvasErrorDetail, setCanvasErrorDetail] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [intake, setIntake] = useState<DesignIntakeState>(() => defaultDesignIntake());
  const [activeDesignSurface, setActiveDesignSurface] = useState<string | null>(null);

  const selectedSurfaces = useMemo(
    () => getSelectedProductComponents(intake),
    [intake],
  );

  const displaySurface = useMemo(
    () =>
      (activeDesignSurface && selectedSurfaces.includes(activeDesignSurface)
        ? activeDesignSurface
        : null) ?? selectedSurfaces[0] ?? null,
    [activeDesignSurface, selectedSurfaces],
  );

  useLayoutEffect(() => {
    intakeRef.current = intake;
    displaySurfaceRef.current = displaySurface;
  }, [intake, displaySurface]);

  const onIntakeChange = useCallback((patch: Partial<DesignIntakeState>) => {
    setIntake((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleGenerateDesignBrief = useCallback(() => {
    setIntake((prev) => {
      const merged =
        !prev.showExtracted
          ? {
              ...prev,
              extracted: buildMockExtracted(),
              showExtracted: true,
            }
          : prev;
      return {
        ...merged,
        designBrief: computeDesignBriefText(merged),
      };
    });
  }, []);

  const ready = canvasPhase === "ready";

  const syncCanvasPreviewCss = useCallback(() => {
    const canvas = fabricRef.current;
    const slot = previewSlotRef.current;
    if (!canvas || !slot) return;
    const slotW = slot.clientWidth;
    if (slotW <= 0) return;
    /** Room for inner card padding (p-2×2) + ring + rounding safety */
    const horizontalGutter = 40;
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

  const refreshJson = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    setJsonText(JSON.stringify(c.toJSON(), null, 2));
  }, []);

  const generateSampleConcept = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;

    const runId = ++generateSampleRunIdRef.current;
    void import("fabric")
      .then((fabric) => {
        if (runId !== generateSampleRunIdRef.current) return;
        const latestIntake = intakeRef.current;
        const spec = shouldUseIntakeDesignSpec(latestIntake)
          ? createDesignSpecFromIntake(
              latestIntake,
              displaySurfaceRef.current,
            )
          : sampleDesignSpec;
        renderDesignSpecToFabric(c, fabric, spec);
        setJsonText(JSON.stringify(c.toJSON(), null, 2));
        setStatus(null);
        queueMicrotask(() => {
          syncCanvasPreviewCss();
        });
      })
      .catch((err) => {
        console.error("Generate sample: failed to load fabric:", err);
        setStatus(
          err instanceof Error
            ? `Could not load Fabric: ${err.message}`
            : "Could not load Fabric module.",
        );
      });
  }, [syncCanvasPreviewCss]);

  useEffect(() => {
    const el = canvasElRef.current;
    if (!el) {
      const msg = "Canvas element not mounted (ref was null).";
      console.error(msg);
      setCanvasPhase("error");
      setCanvasErrorDetail(msg);
      return;
    }

    let cancelled = false;
    setCanvasPhase("initializing");
    setCanvasErrorDetail(null);

    let canvas: Canvas | null = null;

    void import("fabric")
      .then((fabric) => {
        if (cancelled) {
          return;
        }

        try {
          canvas = new fabric.Canvas(el, {
            width: CANVAS_W,
            height: CANVAS_H,
            preserveObjectStacking: true,
          });
        } catch (err) {
          console.error("Fabric canvas initialization failed:", err);
          const msg = err instanceof Error ? err.message : String(err);
          if (!cancelled) {
            setCanvasPhase("error");
            setCanvasErrorDetail(msg);
          }
          return;
        }

        if (cancelled) {
          canvas.dispose();
          return;
        }

        fabricRef.current = canvas;

        const onChange = () => {
          if (!fabricRef.current) return;
          setJsonText(JSON.stringify(fabricRef.current.toJSON(), null, 2));
        };

        canvas.on("object:modified", onChange);
        canvas.on("object:added", onChange);
        canvas.on("object:removed", onChange);
        canvas.on("text:changed", onChange);

        setCanvasPhase("ready");
        setJsonText(JSON.stringify(canvas.toJSON(), null, 2));
      })
      .catch((err) => {
        console.error("Failed to load fabric module:", err);
        const msg = err instanceof Error ? err.message : String(err);
        if (!cancelled) {
          setCanvasPhase("error");
          setCanvasErrorDetail(msg);
        }
      });

    return () => {
      cancelled = true;
      canvas?.dispose();
      fabricRef.current = null;
      setCanvasPhase("initializing");
      setCanvasErrorDetail(null);
    };
  }, [syncCanvasPreviewCss]);

  useLayoutEffect(() => {
    if (!ready) return;
    const slot = previewSlotRef.current;
    const canvas = fabricRef.current;
    if (!slot || !canvas) return;

    const ro = new ResizeObserver(() => {
      syncCanvasPreviewCss();
    });
    ro.observe(slot);
    syncCanvasPreviewCss();
    const raf = requestAnimationFrame(() => {
      syncCanvasPreviewCss();
    });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [ready, syncCanvasPreviewCss]);

  const exportJson = () => {
    refreshJson();
    setStatus("JSON updated in the panel below.");
  };

  const exportPng = () => {
    const c = fabricRef.current;
    if (!c) return;
    const dataUrl = c.toDataURL({ format: "png", multiplier: 1 });
    triggerDownload(dataUrl, "expoprint-concept.png", "image/png");
    setStatus("PNG download started.");
  };

  const exportSvg = () => {
    const c = fabricRef.current;
    if (!c) return;
    const svg = c.toSVG();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, "expoprint-concept.svg", "image/svg+xml");
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setStatus("SVG download started.");
  };

  const loadFromTextarea = () => {
    const c = fabricRef.current;
    if (!c) return;
    try {
      const data = JSON.parse(jsonText) as object;
      void c.loadFromJSON(data).then(() => {
        c.setDimensions({
          width: sampleDesignSpec.canvas.width,
          height: sampleDesignSpec.canvas.height,
        });
        c.requestRenderAll();
        setJsonText(JSON.stringify(c.toJSON(), null, 2));
        setStatus("Design loaded from JSON.");
        queueMicrotask(() => {
          syncCanvasPreviewCss();
        });
      });
    } catch {
      setStatus("Could not parse JSON. Check the textarea contents.");
    }
  };

  const onPickJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setJsonText(text);
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const panelBtn =
    "rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50";

  /** Primary CTA — separate from `panelBtn` so Tailwind does not apply conflicting text/background utilities. */
  const generateSampleBtn =
    "rounded-md border px-3 py-2 text-sm font-medium shadow-sm transition cursor-pointer " +
    "border-zinc-900 bg-zinc-900 text-white " +
    "hover:border-zinc-950 hover:bg-zinc-950 hover:text-white " +
    "disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-600 disabled:shadow-none " +
    "disabled:hover:border-zinc-300 disabled:hover:bg-zinc-200 disabled:hover:text-zinc-600";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm lg:w-96">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
            ExpoPrint AI
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">
            Prototype editor — 10×10 canopy tent concept. Navy, teal, and white.
          </p>
          <p
            className={`mt-2 text-xs font-medium ${
              canvasPhase === "error"
                ? "text-red-600"
                : canvasPhase === "ready"
                  ? "text-emerald-700"
                  : "text-zinc-500"
            }`}
            aria-live="polite"
          >
            {canvasStatusLabel(canvasPhase, canvasErrorDetail)}
          </p>
        </div>

        <DesignIntakePanel
          intake={intake}
          onIntakeChange={onIntakeChange}
          onGenerateDesignBrief={handleGenerateDesignBrief}
        />

        <div className="rounded-lg border border-zinc-100 bg-zinc-50/70 px-3 py-2.5">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900">
            What this proves
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-snug text-zinc-600 marker:text-zinc-400">
            <li>Generated concepts can be editable layers, not flat images.</li>
            <li>Designers can move, resize, and edit text/shapes.</li>
            <li>The app can export Fabric JSON, PNG, and SVG.</li>
            <li>
              Next step: generate DesignSpec from customer website, logo, and
              request.
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            className={generateSampleBtn}
            disabled={!ready}
            onClick={generateSampleConcept}
          >
            Generate Sample Concept
          </button>
          <p className="text-xs leading-snug text-zinc-500" aria-live="polite">
            {shouldUseIntakeDesignSpec(intake)
              ? "Canvas source: intake data"
              : "Canvas source: fallback sample"}
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-zinc-100 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Export / import
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={panelBtn}
              disabled={!ready}
              onClick={exportJson}
            >
              Export JSON
            </button>
            <button
              type="button"
              className={panelBtn}
              disabled={!ready}
              onClick={loadFromTextarea}
            >
              Load JSON
            </button>
            <button
              type="button"
              className={panelBtn}
              disabled={!ready}
              onClick={exportPng}
            >
              Export PNG
            </button>
            <button
              type="button"
              className={panelBtn}
              disabled={!ready}
              onClick={exportSvg}
            >
              Export SVG
            </button>
          </div>
          <button
            type="button"
            className={panelBtn}
            disabled={!ready}
            onClick={() => fileInputRef.current?.click()}
          >
            Choose JSON file…
          </button>
          <label htmlFor="fabric-json-file" className="sr-only">
            Upload canvas JSON file
          </label>
          <input
            id="fabric-json-file"
            ref={fileInputRef}
            name="fabricCanvasJsonFile"
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onPickJsonFile}
          />
        </div>

        <div className="flex flex-1 flex-col gap-2 border-t border-zinc-100 pt-4 min-h-[160px]">
          <label
            htmlFor="fabric-json"
            className="text-xs font-medium uppercase tracking-wide text-zinc-400"
          >
            Canvas JSON
          </label>
          <textarea
            id="fabric-json"
            name="fabricCanvasJson"
            className="min-h-[140px] flex-1 resize-y rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-relaxed text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300"
            spellCheck={false}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder={ready ? "{}" : "Initializing canvas…"}
          />
        </div>

        {status ? (
          <p className="text-xs text-zinc-500" role="status">
            {status}
          </p>
        ) : null}
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
          <p className="min-w-0 shrink-0 text-sm text-zinc-500">
            Artboard {CANVAS_W}×{CANVAS_H}px — preview scales to fit; exports stay
            full size. Drag, scale, and double-click text to edit.
          </p>
          <div className="min-w-0 shrink-0 space-y-2">
            <p className="text-sm font-medium text-zinc-800">
              Current surface:{" "}
              <span className="font-semibold text-zinc-900">
                {displaySurface ?? "—"}
              </span>
            </p>
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
                Design surfaces
              </p>
              {selectedSurfaces.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Select product components in Design intake. One artboard is active; each surface
                  can become its own board later.
                </p>
              ) : (
                <div
                  className="flex flex-wrap gap-1"
                  role="tablist"
                  aria-label="Design surfaces"
                >
                  {selectedSurfaces.map((name) => {
                    const isActive = displaySurface === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className={
                          isActive
                            ? "rounded-md border border-zinc-900 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white"
                            : "rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
                        }
                        onClick={() => setActiveDesignSurface(name)}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="flex min-h-0 min-w-0 w-full flex-1 items-start justify-center overflow-auto rounded-xl border border-zinc-200 bg-zinc-100/80 p-4 shadow-inner sm:p-6">
            <div
              ref={previewSlotRef}
              className="mx-auto box-border flex w-full min-w-0 max-w-full shrink-0 justify-center px-0.5"
            >
              <div className="max-w-full shrink-0 rounded-lg bg-white p-2 shadow-md ring-1 ring-black/5">
                <canvas ref={canvasElRef} width={CANVAS_W} height={CANVAS_H} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
