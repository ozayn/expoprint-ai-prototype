"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Canvas } from "fabric";
import {
  analyzeStatusLineFromApiPayload,
  formatClaudeSuccessStatusLine,
} from "@/lib/analyzeWebsiteResponse";
import { applyClaudeAnalyzeSuccessToIntake } from "@/lib/analyzeWebsiteSuggestions";
import { isValidExtractedRowsPayload } from "@/lib/claudeExtractedContent";
import {
  createDesignSpecFromIntake,
  shouldUseIntakeDesignSpec,
} from "@/lib/createDesignSpecFromIntake";
import {
  BOOTH_COMPONENTS,
  buildMockExtracted,
  computeDesignBriefText,
  emptyExtracted,
  EXTRACTED_LABELS,
  type ExtractedKey,
  getSelectedProductComponents,
  OUTDOOR_COMPONENTS,
  type DesignIntakeState,
  type ProductCategory,
  type StylePreference,
} from "@/lib/designIntakeState";
import { sampleDesignSpec } from "@/lib/designSpec";
import { renderDesignSpecToFabric } from "@/lib/renderDesignSpecToFabric";
import { LogoCandidatesReview } from "@/components/LogoCandidatesReview";
import { TypographySignalsRow } from "@/components/TypographySignalsRow";

const { width: CANVAS_W, height: CANVAS_H } = sampleDesignSpec.canvas;
const TOTAL_STEPS = 7;

const STYLE_HINTS: Record<
  StylePreference,
  { fits: string; direction: string; content: string }
> = {
  Modern: {
    fits: "technology, service brands, startups",
    direction: "bold color block, clean spacing, large headline",
    content: "keep copy short and one clear service line",
  },
  Conservative: {
    fits: "healthcare, finance, legal, B2B",
    direction: "restrained contrast, simple structure",
    content: "trust, contact info, clear services",
  },
  Traditional: {
    fits: "local businesses, markets, community",
    direction: "centered logo/name, straightforward hierarchy",
    content: "name, phone, website, core offering",
  },
  Playful: {
    fits: "events, food, lifestyle, creative brands",
    direction: "larger accents, energetic layout",
    content: "friendly headline, short memorable phrases",
  },
};

function blankIntake(): DesignIntakeState {
  const base: DesignIntakeState = {
    websiteUrl: "",
    businessName: "",
    category: "Outdoor tent",
    style: "Modern",
    instructions: "",
    componentsOutdoor: {
      "Canopy tent": true,
      "Back wall": false,
      "Side wall": false,
      Flag: false,
    },
    componentsBooth: {
      Backdrop: true,
      Counter: false,
      Header: false,
      "Product/service panels": false,
    },
    extracted: emptyExtracted(),
    showExtracted: false,
    extractionSource: "none",
    logoCandidates: [],
    selectedLogoCandidateUrl: "",
    typographySignals: null,
    designBrief: "",
  };
  return { ...base, designBrief: computeDesignBriefText(base) };
}

const fieldClass =
  "mt-2 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-4 py-3.5 text-base text-zinc-900 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300";
const btnPrimary =
  "inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-zinc-950 touch-manipulation disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[140px]";
const btnSecondary =
  "inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 py-3 text-base font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 touch-manipulation sm:w-auto sm:min-w-[120px]";
const choiceBtn =
  "min-h-12 w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left text-base font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 touch-manipulation data-[active=true]:border-zinc-900 data-[active=true]:bg-zinc-900 data-[active=true]:text-white";

export function GuidedIntakeDemo() {
  const [step, setStep] = useState(1);
  const [intake, setIntake] = useState<DesignIntakeState>(() => blankIntake());
  const [analyzeInProgress, setAnalyzeInProgress] = useState(false);
  const [analyzeStatusLine, setAnalyzeStatusLine] = useState("");
  const [analyzeBusinessNameNote, setAnalyzeBusinessNameNote] = useState("");

  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const previewSlotRef = useRef<HTMLDivElement>(null);
  const intakeRef = useRef(intake);
  const displaySurfaceRef = useRef<string | null>(null);
  const generateRunIdRef = useRef(0);

  const [canvasPhase, setCanvasPhase] = useState<
    "idle" | "initializing" | "ready" | "error"
  >("idle");
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const [activeDesignSurface, setActiveDesignSurface] = useState<string | null>(
    null,
  );

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

  const patchIntake = useCallback((patch: Partial<DesignIntakeState>) => {
    if ("businessName" in patch) {
      setAnalyzeBusinessNameNote("");
    }
    setIntake((prev) => {
      const next = { ...prev, ...patch };
      const keys = Object.keys(patch) as (keyof DesignIntakeState)[];
      const onlyBrief = keys.length === 1 && keys[0] === "designBrief";
      if (onlyBrief) return next;
      return { ...next, designBrief: computeDesignBriefText(next) };
    });
  }, []);

  const syncCanvasPreviewCss = useCallback(() => {
    const canvas = fabricRef.current;
    const slot = previewSlotRef.current;
    if (!canvas || !slot) return;
    const slotW = slot.clientWidth;
    if (slotW <= 0) return;
    const horizontalGutter = slotW < 400 ? 16 : slotW < 640 ? 24 : 32;
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

  const runGenerate = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    const runId = ++generateRunIdRef.current;
    void import("fabric").then((fabric) => {
      if (runId !== generateRunIdRef.current) return;
      const latest = intakeRef.current;
      const spec = shouldUseIntakeDesignSpec(latest)
        ? createDesignSpecFromIntake(latest, displaySurfaceRef.current)
        : sampleDesignSpec;
      renderDesignSpecToFabric(c, fabric, spec);
      queueMicrotask(() => syncCanvasPreviewCss());
    });
  }, [syncCanvasPreviewCss]);

  useEffect(() => {
    if (step !== 7) return;

    const el = canvasElRef.current;
    if (!el) return;

    let cancelled = false;
    let canvas: Canvas | null = null;
    setCanvasPhase("initializing");
    setCanvasError(null);

    void import("fabric")
      .then((fabric) => {
        if (cancelled) return;
        try {
          canvas = new fabric.Canvas(el, {
            width: CANVAS_W,
            height: CANVAS_H,
            preserveObjectStacking: true,
          });
        } catch (e) {
          setCanvasPhase("error");
          setCanvasError(e instanceof Error ? e.message : String(e));
          return;
        }
        if (cancelled) {
          canvas.dispose();
          return;
        }
        fabricRef.current = canvas;
        setCanvasPhase("ready");
        queueMicrotask(() => {
          runGenerate();
        });
      })
      .catch((e) => {
        setCanvasPhase("error");
        setCanvasError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      cancelled = true;
      canvas?.dispose();
      fabricRef.current = null;
      setCanvasPhase("idle");
    };
  }, [step, runGenerate]);

  const ready = canvasPhase === "ready";

  useLayoutEffect(() => {
    if (step !== 7 || !ready) return;
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
  }, [step, ready, syncCanvasPreviewCss]);

  const handleAnalyze = useCallback(async () => {
    setAnalyzeInProgress(true);
    setAnalyzeBusinessNameNote("");
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
        setAnalyzeStatusLine(formatClaudeSuccessStatusLine(rec ?? {}));
        let nameNote = "";
        setIntake((prev) => {
          // Same suggestedBusinessName / URL rules as / (FabricDesignEditor).
          const { next, businessNameNote } = applyClaudeAnalyzeSuccessToIntake(
            prev,
            extractedUnknown,
            rec ?? {},
          );
          nameNote = businessNameNote;
          return next;
        });
        setAnalyzeBusinessNameNote(nameNote);
        setStep(6);
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
      setAnalyzeStatusLine("Using mocked extraction: request failed.");
    } finally {
      setAnalyzeInProgress(false);
    }

    setAnalyzeBusinessNameNote("");
    setIntake((prev) => {
      const next: DesignIntakeState = {
        ...prev,
        extracted: buildMockExtracted(),
        showExtracted: true,
        extractionSource: "mock_fallback",
        logoCandidates: [],
        selectedLogoCandidateUrl: "",
        typographySignals: null,
      };
      return { ...next, designBrief: computeDesignBriefText(next) };
    });
    setStep(6);
  }, []);

  const briefPreview = useMemo(() => {
    const t = intake.designBrief.trim();
    if (t.length <= 900) return t;
    return `${t.slice(0, 900)}…`;
  }, [intake.designBrief]);

  const setCategory = (cat: ProductCategory) => {
    if (cat === "Outdoor tent") {
      patchIntake({
        category: cat,
        componentsOutdoor: {
          "Canopy tent": true,
          "Back wall": false,
          "Side wall": false,
          Flag: false,
        },
      });
    } else {
      patchIntake({
        category: cat,
        componentsBooth: {
          Backdrop: true,
          Counter: false,
          Header: false,
          "Product/service panels": false,
        },
      });
    }
  };

  const toggleComponent = (name: string, checked: boolean) => {
    if (intake.category === "Outdoor tent") {
      patchIntake({
        componentsOutdoor: {
          ...intake.componentsOutdoor,
          [name]: checked,
        } as DesignIntakeState["componentsOutdoor"],
      });
    } else {
      patchIntake({
        componentsBooth: {
          ...intake.componentsBooth,
          [name]: checked,
        } as DesignIntakeState["componentsBooth"],
      });
    }
  };

  const outdoorList = OUTDOOR_COMPONENTS as readonly string[];
  const boothList = BOOTH_COMPONENTS as readonly string[];

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 pb-16 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-500">
          Step {step} of {TOTAL_STEPS}
        </p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
        >
          Open editor view
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
        {step === 1 && (
          <div className="space-y-4">
            <h1 className="text-lg font-semibold text-zinc-900">
              What is your business website?
            </h1>
            <p className="text-sm leading-relaxed text-zinc-600">
              Enter the homepage first. Analysis can suggest identity, brand, and design content;
              you will confirm the business name after analysis.
            </p>
            <label htmlFor="demo-url" className="sr-only">
              Website URL
            </label>
            <input
              id="demo-url"
              type="url"
              inputMode="url"
              className={fieldClass}
              value={intake.websiteUrl}
              onChange={(e) => patchIntake({ websiteUrl: e.target.value })}
              placeholder="https://…"
              autoComplete="url"
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h1 className="text-lg font-semibold text-zinc-900">
              What are you designing?
            </h1>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className={choiceBtn}
                data-active={intake.category === "Outdoor tent"}
                onClick={() => setCategory("Outdoor tent")}
              >
                Outdoor tent
              </button>
              <button
                type="button"
                className={choiceBtn}
                data-active={intake.category === "Trade show booth"}
                onClick={() => setCategory("Trade show booth")}
              >
                Trade show booth
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h1 className="text-lg font-semibold text-zinc-900">
              Which pieces do you need?
            </h1>
            <ul className="space-y-2">
              {(intake.category === "Outdoor tent" ? outdoorList : boothList).map(
                (name) => {
                  const checked =
                    intake.category === "Outdoor tent"
                      ? intake.componentsOutdoor[
                          name as keyof typeof intake.componentsOutdoor
                        ]
                      : intake.componentsBooth[
                          name as keyof typeof intake.componentsBooth
                        ];
                  const id = `demo-comp-${name.replace(/\s+/g, "-")}`;
                  return (
                    <li
                      key={name}
                      className="flex min-h-12 items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2"
                    >
                      <input
                        id={id}
                        type="checkbox"
                        className="size-5 shrink-0 rounded border-zinc-300 text-zinc-900"
                        checked={checked}
                        onChange={(e) => toggleComponent(name, e.target.checked)}
                      />
                      <label htmlFor={id} className="flex-1 text-base text-zinc-800">
                        {name}
                      </label>
                    </li>
                  );
                },
              )}
            </ul>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h1 className="text-lg font-semibold text-zinc-900">
              Which style feels closest to your brand?
            </h1>
            <div className="flex flex-col gap-2">
              {(
                ["Modern", "Conservative", "Traditional", "Playful"] as const
              ).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={choiceBtn}
                  data-active={intake.style === s}
                  onClick={() => patchIntake({ style: s })}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="rounded-lg border border-zinc-100 bg-zinc-50/90 px-3 py-2 text-xs leading-relaxed text-zinc-600">
              <p className="font-medium text-zinc-700">Style suggestion</p>
              <p className="mt-1">
                <span className="font-medium">Fits:</span>{" "}
                {STYLE_HINTS[intake.style].fits}.
              </p>
              <p>
                <span className="font-medium">Direction:</span>{" "}
                {STYLE_HINTS[intake.style].direction}.
              </p>
              <p>
                <span className="font-medium">Content:</span>{" "}
                {STYLE_HINTS[intake.style].content}.
              </p>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h1 className="text-lg font-semibold text-zinc-900">
              Anything specific the designer should know?
            </h1>
            <textarea
              className={`${fieldClass} min-h-[120px] resize-y font-sans`}
              value={intake.instructions}
              onChange={(e) => patchIntake({ instructions: e.target.value })}
              placeholder="Sizing, deadlines, must-haves…"
            />
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <h1 className="text-lg font-semibold text-zinc-900">
              Review identity
            </h1>
            <p className="text-sm leading-relaxed text-zinc-600">
              Confirm the name designers should use, then review extracted content for your concept.
            </p>
            {analyzeStatusLine ? (
              <p className="text-sm text-zinc-600" aria-live="polite">
                {analyzeStatusLine}
              </p>
            ) : null}
            {analyzeBusinessNameNote ? (
              <p className="text-[11px] leading-snug text-zinc-500" aria-live="polite">
                {analyzeBusinessNameNote}
              </p>
            ) : null}
            <div className="space-y-2 border-b border-zinc-100 pb-4">
              <label
                htmlFor="demo-review-business"
                className="text-xs font-medium text-zinc-600"
              >
                Business name
              </label>
              <input
                id="demo-review-business"
                type="text"
                className={fieldClass}
                value={intake.businessName}
                onChange={(e) => patchIntake({ businessName: e.target.value })}
                autoComplete="organization"
                placeholder="Company or brand name"
              />
              {intake.businessName.trim() === "" ? (
                <p className="text-xs leading-snug text-zinc-500">
                  Confirm the business name before generating a concept.
                </p>
              ) : null}
            </div>
            <div className="border-b border-zinc-100 pb-4">
              <TypographySignalsRow
                signals={intake.typographySignals}
                extractionSource={intake.extractionSource}
              />
              <LogoCandidatesReview
                candidates={intake.logoCandidates}
                selectedUrl={intake.selectedLogoCandidateUrl}
                onSelect={(url) =>
                  patchIntake({ selectedLogoCandidateUrl: url })
                }
                variant="wide"
              />
            </div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Extracted content
            </p>
            <div className="space-y-3">
              {(Object.keys(EXTRACTED_LABELS) as ExtractedKey[]).map((key) => {
                const row = intake.extracted[key];
                const incId = `demo-ex-${key}`;
                const valId = `demo-exv-${key}`;
                return (
                  <div
                    key={key}
                    className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3"
                  >
                    <div className="flex gap-3">
                      <input
                        id={incId}
                        type="checkbox"
                        className="mt-1 size-5 shrink-0 rounded border-zinc-300"
                        checked={row.useForDesign}
                        onChange={(e) =>
                          patchIntake({
                            extracted: {
                              ...intake.extracted,
                              [key]: {
                                ...row,
                                useForDesign: e.target.checked,
                              },
                            },
                          })
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <label
                          htmlFor={valId}
                          className="text-xs font-medium text-zinc-600"
                        >
                          {EXTRACTED_LABELS[key]}
                        </label>
                        <textarea
                          id={valId}
                          rows={2}
                          className="mt-1 w-full rounded border border-zinc-200 bg-white px-2 py-2 text-sm text-zinc-900"
                          value={row.value}
                          onChange={(e) =>
                            patchIntake({
                              extracted: {
                                ...intake.extracted,
                                [key]: {
                                  ...row,
                                  value: e.target.value,
                                },
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-5">
            <h1 className="text-lg font-semibold text-zinc-900">Your concept</h1>
            <div>
              <h2 className="text-sm font-medium text-zinc-700">Design brief</h2>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-100 bg-zinc-50 p-3 font-mono text-xs leading-relaxed text-zinc-800">
                {briefPreview}
              </pre>
            </div>
            {selectedSurfaces.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Design surfaces
                </p>
                <div className="flex flex-wrap gap-2" role="tablist">
                  {selectedSurfaces.map((name) => {
                    const active = displaySurface === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        className={
                          active
                            ? "min-h-11 rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-medium text-white"
                            : "min-h-11 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-sm"
                        }
                        onClick={() => setActiveDesignSurface(name)}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div
              ref={previewSlotRef}
              className="flex w-full min-w-0 justify-center overflow-x-hidden rounded-xl border border-zinc-200 bg-zinc-100/80 p-3"
            >
              <div className="max-w-full rounded-lg bg-white p-2 shadow ring-1 ring-black/5">
                <canvas ref={canvasElRef} width={CANVAS_W} height={CANVAS_H} />
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              {canvasPhase === "initializing" && "Preparing canvas…"}
              {canvasPhase === "error" && (canvasError ?? "Canvas error")}
              {ready &&
                (shouldUseIntakeDesignSpec(intake)
                  ? "Source: your intake"
                  : "Source: sample fallback")}
            </p>
            <p className="text-xs text-zinc-400">
              {CANVAS_W}×{CANVAS_H}px artboard — preview scales to fit; open the
              editor for PNG/SVG/JSON export.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button
          type="button"
          className={btnSecondary}
          disabled={step === 1 || (step === 5 && analyzeInProgress)}
          onClick={() => {
            if (step === 7) {
              setStep(6);
              return;
            }
            setStep((s) => Math.max(1, s - 1));
          }}
        >
          Back
        </button>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          {step < 5 && (
            <button
              type="button"
              className={btnPrimary}
              onClick={() => setStep((s) => s + 1)}
            >
              Continue
            </button>
          )}
          {step === 5 && (
            <button
              type="button"
              className={btnPrimary}
              disabled={analyzeInProgress}
              onClick={() => void handleAnalyze()}
            >
              {analyzeInProgress ? "Analyzing…" : "Analyze website"}
            </button>
          )}
          {step === 6 && (
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                patchIntake({
                  designBrief: computeDesignBriefText(intakeRef.current),
                });
                setStep(7);
              }}
            >
              Generate concept
            </button>
          )}
          {step === 7 && (
            <>
              <button
                type="button"
                className={btnPrimary}
                disabled={!ready}
                onClick={() => runGenerate()}
              >
                Regenerate concept
              </button>
              <Link
                href="/"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 underline-offset-4 hover:underline"
              >
                Open editor view for export tools
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
