"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Canvas } from "fabric";
import { DesignIntakePanel } from "@/components/DesignIntakePanel";
import { analyzeStatusLineFromApiPayload } from "@/lib/analyzeWebsiteResponse";
import { isValidExtractedRowsPayload } from "@/lib/claudeExtractedContent";
import {
  createDesignSpecFromIntake,
  shouldUseIntakeDesignSpec,
} from "@/lib/createDesignSpecFromIntake";
import {
  buildMockExtracted,
  computeDesignBriefText,
  defaultDesignIntake,
  getSelectedProductComponents,
  type DesignIntakeState,
} from "@/lib/designIntakeState";
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
  const [analyzeInProgress, setAnalyzeInProgress] = useState(false);
  const [analyzeStatusLine, setAnalyzeStatusLine] = useState("");

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
    setIntake((prev) => {
      const next = { ...prev, ...patch };
      const patchKeys = Object.keys(patch) as (keyof DesignIntakeState)[];
      const onlyBriefEdited =
        patchKeys.length === 1 && patchKeys[0] === "designBrief";
      if (onlyBriefEdited) return next;
      return { ...next, designBrief: computeDesignBriefText(next) };
    });
  }, []);

  const handleRefreshDesignBrief = useCallback(() => {
    setIntake((prev) => ({
      ...prev,
      designBrief: computeDesignBriefText(prev),
    }));
  }, []);

  const handleAnalyzeWebsite = useCallback(async () => {
    setAnalyzeInProgress(true);
    try {
      const snap = intakeRef.current;
      const res = await fetch("/api/analyze-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: snap.websiteUrl,
          businessName: snap.businessName,
          productCategory: snap.category,
          style: snap.style,
          specialInstructions: snap.instructions,
        }),
      });
      const data: unknown = await res.json().catch(() => null);
      const rec =
        data && typeof data === "object"
          ? (data as Record<string, unknown>)
          : null;
      const extractedUnknown =
        rec && "extracted" in rec
          ? (rec as { extracted: unknown }).extracted
          : undefined;

      const apiClaimsClaude = Boolean(
        rec && rec.ok === true && rec.source === "claude",
      );

      if (apiClaimsClaude && isValidExtractedRowsPayload(extractedUnknown)) {
        setAnalyzeStatusLine("Claude extraction used.");
        setIntake((prev) => {
          const next: DesignIntakeState = {
            ...prev,
            extracted: extractedUnknown,
            showExtracted: true,
            extractionSource: "claude",
          };
          return { ...next, designBrief: computeDesignBriefText(next) };
        });
        return;
      }

      if (apiClaimsClaude) {
        setAnalyzeStatusLine(
          "Using mocked extraction: invalid Claude response.",
        );
      } else {
        setAnalyzeStatusLine(analyzeStatusLineFromApiPayload(data).line);
      }
    } catch {
      setAnalyzeStatusLine("Using mocked extraction for prototype.");
    } finally {
      setAnalyzeInProgress(false);
    }

    setIntake((prev) => {
      const next: DesignIntakeState = {
        ...prev,
        extracted: buildMockExtracted(),
        showExtracted: true,
        extractionSource: "mock_fallback",
      };
      return { ...next, designBrief: computeDesignBriefText(next) };
    });
  }, []);

  const ready = canvasPhase === "ready";

  const syncCanvasPreviewCss = useCallback(() => {
    const canvas = fabricRef.current;
    const slot = previewSlotRef.current;
    if (!canvas || !slot) return;
    const slotW = slot.clientWidth;
    if (slotW <= 0) return;
    /** Room for inner card padding + ring; tighter on narrow viewports to avoid horizontal scroll. */
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
    "flex min-h-11 w-full items-center justify-center rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation sm:min-h-0 sm:py-2";

  /** Primary CTA — separate from `panelBtn` so Tailwind does not apply conflicting text/background utilities. */
  const generateSampleBtn =
    "flex min-h-11 w-full items-center justify-center rounded-md border px-3 py-2.5 text-sm font-medium shadow-sm transition cursor-pointer touch-manipulation sm:min-h-0 sm:py-2 " +
    "border-zinc-900 bg-zinc-900 text-white " +
    "hover:border-zinc-950 hover:bg-zinc-950 hover:text-white " +
    "disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-600 disabled:shadow-none " +
    "disabled:hover:border-zinc-300 disabled:hover:bg-zinc-200 disabled:hover:text-zinc-600";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-8 lg:flex-row lg:items-start lg:gap-6">
      <aside className="flex w-full max-w-full shrink-0 flex-col gap-5 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:gap-4 sm:p-5 lg:min-h-0 lg:w-96 lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto lg:overscroll-y-contain">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-lg">
            ExpoPrint AI
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500 sm:text-sm">
            Prototype — intake to editable canvas (mock extraction, no AI).
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
          onRefreshDesignBrief={handleRefreshDesignBrief}
          analyzeInProgress={analyzeInProgress}
          onAnalyzeWebsite={handleAnalyzeWebsite}
          analyzeStatusLine={analyzeStatusLine}
        />

        <details className="group rounded-lg border border-zinc-200 bg-zinc-50/80">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 text-sm font-medium text-zinc-800 [&::-webkit-details-marker]:hidden">
            <span>Export, import & developer tools</span>
            <span
              className="inline-block shrink-0 text-zinc-400 transition-transform group-open:rotate-180"
              aria-hidden
            >
              ▼
            </span>
          </summary>
          <div className="space-y-3 border-t border-zinc-200 px-3 pb-3 pt-3 sm:px-4">
            <p className="text-xs leading-relaxed text-zinc-500">
              PNG/SVG/JSON use the full {CANVAS_W}×{CANVAS_H}px canvas.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-2">
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

            <details className="rounded-md border border-zinc-200 bg-white">
              <summary className="cursor-pointer px-3 py-2.5 text-xs font-medium text-zinc-700 [&::-webkit-details-marker]:hidden">
                Canvas JSON (raw)
              </summary>
              <div className="border-t border-zinc-100 p-2 sm:p-3">
                <textarea
                  id="fabric-json"
                  name="fabricCanvasJson"
                  className="min-h-[180px] w-full min-w-0 resize-y rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-relaxed text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300 sm:text-[11px]"
                  spellCheck={false}
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder={ready ? "{}" : "Initializing canvas…"}
                />
              </div>
            </details>

            {status ? (
              <p className="text-xs text-zinc-500" role="status">
                {status}
              </p>
            ) : null}

            <details className="rounded-md border border-dashed border-zinc-200 bg-white/80 px-2 py-1">
              <summary className="cursor-pointer px-2 py-2 text-xs font-medium text-zinc-600 [&::-webkit-details-marker]:hidden">
                About this demo
              </summary>
              <ul className="list-disc space-y-1 pb-2 pl-5 pr-2 text-[11px] leading-snug text-zinc-500 marker:text-zinc-400">
                <li>Concepts stay editable layers, not flat images.</li>
                <li>Move, scale, and double-click text on the canvas.</li>
                <li>Next: real site ingest and AI-generated DesignSpec.</li>
              </ul>
            </details>
          </div>
        </details>
      </aside>

      <section className="flex min-h-0 w-full max-w-full min-w-0 flex-1 flex-col lg:sticky lg:top-8 lg:z-10 lg:self-start">
        <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col gap-4 overflow-x-hidden">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-900 sm:text-sm">
              Editable concept preview
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              {CANVAS_W}×{CANVAS_H}px artboard — preview scales to your screen; exports stay full size.
            </p>
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
            <p className="text-xs leading-relaxed text-zinc-500" aria-live="polite">
              {shouldUseIntakeDesignSpec(intake)
                ? "Canvas source: intake data"
                : "Canvas source: fallback sample"}
            </p>
            <p className="text-xs leading-relaxed text-zinc-400">
              Regenerate the concept to update the editable canvas. Manual canvas edits are preserved
              until regeneration.
            </p>
          </div>

          <div className="min-w-0 shrink-0 space-y-2">
            <p className="text-sm font-medium leading-snug text-zinc-800">
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
                <p className="text-xs leading-relaxed text-zinc-500">
                  Select components in Design intake. One surface at a time for now.
                </p>
              ) : (
                <div
                  className="flex flex-wrap gap-2 sm:gap-1"
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
                            ? "min-h-10 touch-manipulation rounded-md border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-medium text-white sm:min-h-0 sm:px-2.5 sm:py-1"
                            : "min-h-10 touch-manipulation rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 sm:min-h-0 sm:px-2.5 sm:py-1"
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
          <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 items-start justify-center overflow-x-hidden overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-100/80 p-3 shadow-inner sm:p-4 lg:p-6">
            <div
              ref={previewSlotRef}
              className="mx-auto box-border flex w-full min-w-0 max-w-full shrink-0 justify-center px-0"
            >
              <div className="max-w-full min-w-0 shrink-0 rounded-lg bg-white p-2 shadow-md ring-1 ring-black/5">
                <canvas ref={canvasElRef} width={CANVAS_W} height={CANVAS_H} />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
