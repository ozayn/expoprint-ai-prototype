"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Canvas } from "fabric";
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

  const [canvasPhase, setCanvasPhase] = useState<CanvasPhase>("initializing");
  const [canvasErrorDetail, setCanvasErrorDetail] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const ready = canvasPhase === "ready";

  const refreshJson = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    setJsonText(JSON.stringify(c.toJSON(), null, 2));
  }, []);

  const generateSampleConcept = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;

    void import("fabric").then((fabric) => {
      renderDesignSpecToFabric(c, fabric, sampleDesignSpec);
      setJsonText(JSON.stringify(c.toJSON(), null, 2));
      setStatus(null);
    }).catch((err) => {
      console.error("Generate sample: failed to load fabric:", err);
      setStatus(
        err instanceof Error
          ? `Could not load Fabric: ${err.message}`
          : "Could not load Fabric module.",
      );
    });
  }, []);

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
  }, []);

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
    <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm lg:w-80">
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

        <div className="flex flex-col gap-2">
          <button
            type="button"
            className={generateSampleBtn}
            disabled={!ready}
            onClick={generateSampleConcept}
          >
            Generate Sample Concept
          </button>
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
          <input
            ref={fileInputRef}
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

      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-500">
            Canvas {CANVAS_W}×{CANVAS_H}px — drag, scale, and double-click text
            to edit.
          </p>
        </div>
        <div className="flex flex-1 items-start justify-center overflow-auto rounded-xl border border-zinc-200 bg-zinc-100/80 p-6 shadow-inner">
          <div className="rounded-lg bg-white p-2 shadow-md ring-1 ring-black/5">
            <canvas ref={canvasElRef} width={CANVAS_W} height={CANVAS_H} />
          </div>
        </div>
      </section>
    </div>
  );
}
