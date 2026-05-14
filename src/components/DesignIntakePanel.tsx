"use client";

import { useCallback, useMemo } from "react";
import {
  BOOTH_COMPONENTS,
  type BoothComponent,
  buildMockExtracted,
  type DesignIntakeState,
  EXTRACTED_LABELS,
  type ExtractedKey,
  getSelectedExtractedLabels,
  getSelectedProductComponents,
  OUTDOOR_COMPONENTS,
  type OutdoorComponent,
  type ProductCategory,
  type StylePreference,
} from "@/lib/designIntakeState";

const STYLE_SUGGESTIONS: Record<
  StylePreference,
  { fits: string; direction: string; content: string }
> = {
  Modern: {
    fits: "technology, service brands, startups",
    direction: "bold color block, clean spacing, large headline",
    content: "keep copy short and use one clear service line",
  },
  Conservative: {
    fits: "healthcare, finance, legal, B2B services",
    direction: "restrained contrast, simple structure, minimal decorative shapes",
    content: "prioritize trust, contact info, and clear services",
  },
  Traditional: {
    fits: "local businesses, markets, community events",
    direction: "centered logo/name, straightforward hierarchy, easy readability",
    content: "include business name, phone, website, and core offering",
  },
  Playful: {
    fits: "events, food, lifestyle, kids, creative brands",
    direction: "larger accent shapes and more energetic composition",
    content: "use a friendly headline and short memorable phrases",
  },
};

/** Illustrative swatches only — not wired to extracted brand colors. */
const STYLE_THEME_CHIPS: Record<
  StylePreference,
  readonly [string, string, string]
> = {
  Modern: [
    "h-8 w-11 shrink-0 rounded-md bg-[#0c2340] shadow-sm ring-1 ring-black/5",
    "h-8 w-11 shrink-0 rounded-md bg-teal-600 shadow-sm ring-1 ring-black/5",
    "h-8 w-11 shrink-0 rounded-md border border-zinc-200/90 bg-white shadow-sm",
  ],
  Conservative: [
    "h-8 w-11 shrink-0 rounded-md bg-[#1e3a5f] shadow-sm ring-1 ring-black/5",
    "h-8 w-11 shrink-0 rounded-md bg-zinc-400 shadow-sm ring-1 ring-black/5",
    "h-8 w-11 shrink-0 rounded-md border border-teal-200/70 bg-teal-100/90 shadow-sm",
  ],
  Traditional: [
    "h-8 w-11 shrink-0 rounded-md bg-[#0a1628] shadow-sm ring-1 ring-black/5",
    "h-8 w-11 shrink-0 rounded-md border border-zinc-200 bg-white shadow-sm",
    "h-8 w-11 shrink-0 rounded-md border-2 border-zinc-300 bg-white shadow-sm ring-1 ring-zinc-200/60",
  ],
  Playful: [
    "h-8 w-11 shrink-0 rounded-md bg-teal-500 shadow-sm ring-1 ring-black/5",
    "h-8 w-11 shrink-0 rounded-md bg-slate-900 shadow-sm ring-1 ring-black/5",
    "h-8 w-11 shrink-0 -rotate-6 rounded-md border border-amber-200/80 bg-amber-50 shadow-sm",
  ],
};

const fieldClass =
  "mt-1 w-full min-w-0 rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300 sm:px-2 sm:py-1.5 sm:text-sm";
const labelClass = "text-xs font-medium text-zinc-600";
const sectionHeading = "text-sm font-semibold tracking-tight text-zinc-900";
const sectionHint = "text-xs leading-relaxed text-zinc-500";
const subLabel = "text-[11px] font-medium uppercase tracking-wide text-zinc-400";

export type DesignIntakePanelProps = {
  intake: DesignIntakeState;
  onIntakeChange: (patch: Partial<DesignIntakeState>) => void;
  onRefreshDesignBrief: () => void;
};

export function DesignIntakePanel({
  intake,
  onIntakeChange,
  onRefreshDesignBrief,
}: DesignIntakePanelProps) {
  const activeComponents = useMemo(() => {
    return intake.category === "Outdoor tent"
      ? OUTDOOR_COMPONENTS
      : BOOTH_COMPONENTS;
  }, [intake.category]);

  const selectedComponents = useMemo(
    () => getSelectedProductComponents(intake),
    [intake],
  );
  const selectedExtractedLabels = useMemo(
    () => getSelectedExtractedLabels(intake),
    [intake],
  );

  const toggleComponent = useCallback(
    (name: string, checked: boolean) => {
      if (intake.category === "Outdoor tent") {
        onIntakeChange({
          componentsOutdoor: {
            ...intake.componentsOutdoor,
            [name as OutdoorComponent]: checked,
          },
        });
      } else {
        onIntakeChange({
          componentsBooth: {
            ...intake.componentsBooth,
            [name as BoothComponent]: checked,
          },
        });
      }
    },
    [intake.category, intake.componentsBooth, intake.componentsOutdoor, onIntakeChange],
  );

  const analyzeWebsite = useCallback(() => {
    onIntakeChange({
      extracted: buildMockExtracted(),
      showExtracted: true,
    });
  }, [onIntakeChange]);

  const setExtractedValue = useCallback(
    (key: ExtractedKey, value: string) => {
      onIntakeChange({
        extracted: {
          ...intake.extracted,
          [key]: { ...intake.extracted[key], value },
        },
      });
    },
    [intake.extracted, onIntakeChange],
  );

  const setExtractedUse = useCallback(
    (key: ExtractedKey, useForDesign: boolean) => {
      onIntakeChange({
        extracted: {
          ...intake.extracted,
          [key]: { ...intake.extracted[key], useForDesign },
        },
      });
    },
    [intake.extracted, onIntakeChange],
  );

  return (
    <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-zinc-50/40">
      {/* A — Design intake */}
      <section className="space-y-3 px-3 py-4 sm:px-4" aria-labelledby="section-design-intake">
        <div>
          <h2 id="section-design-intake" className={sectionHeading}>
            Design intake
          </h2>
          <p className={`mt-1 ${sectionHint}`}>
            Website, business, and product choices (mock analysis only).
          </p>
        </div>

        <div>
          <label htmlFor="intake-website" className={labelClass}>
            Business website URL
          </label>
          <input
            id="intake-website"
            name="businessWebsiteUrl"
            type="url"
            className={fieldClass}
            value={intake.websiteUrl}
            onChange={(e) => onIntakeChange({ websiteUrl: e.target.value })}
            placeholder="https://…"
            autoComplete="url"
          />
        </div>
        <div>
          <label htmlFor="intake-name" className={labelClass}>
            Business name
          </label>
          <input
            id="intake-name"
            name="businessName"
            type="text"
            className={fieldClass}
            value={intake.businessName}
            onChange={(e) => onIntakeChange({ businessName: e.target.value })}
            autoComplete="organization"
          />
        </div>
        <div>
          <label htmlFor="intake-category" className={labelClass}>
            Product category
          </label>
          <select
            id="intake-category"
            name="productCategory"
            className={fieldClass}
            value={intake.category}
            onChange={(e) =>
              onIntakeChange({
                category: e.target.value as ProductCategory,
              })
            }
          >
            <option value="Outdoor tent">Outdoor tent</option>
            <option value="Trade show booth">Trade show booth</option>
          </select>
        </div>
        <div>
          <label htmlFor="intake-style" className={labelClass}>
            Style preference
          </label>
          <select
            id="intake-style"
            name="stylePreference"
            className={fieldClass}
            value={intake.style}
            onChange={(e) =>
              onIntakeChange({
                style: e.target.value as StylePreference,
              })
            }
          >
            <option value="Modern">Modern</option>
            <option value="Conservative">Conservative</option>
            <option value="Traditional">Traditional</option>
            <option value="Playful">Playful</option>
          </select>
        </div>

        <div
          className="rounded-md border border-zinc-200 bg-white px-2.5 py-2.5 sm:px-3 sm:py-2"
          aria-live="polite"
        >
          <p className={`${subLabel} mb-2`}>Style suggestion</p>
          <ul className="space-y-1.5 text-xs leading-snug text-zinc-600">
            <li>
              <span className="font-medium text-zinc-700">Fits:</span>{" "}
              {STYLE_SUGGESTIONS[intake.style].fits}.
            </li>
            <li>
              <span className="font-medium text-zinc-700">Direction:</span>{" "}
              {STYLE_SUGGESTIONS[intake.style].direction}.
            </li>
            <li>
              <span className="font-medium text-zinc-700">Content:</span>{" "}
              {STYLE_SUGGESTIONS[intake.style].content}.
            </li>
          </ul>

          <div className="mt-3 border-t border-zinc-100 pt-3">
            <p className={`${subLabel} mb-2`}>Theme preview</p>
            <div
              className="flex flex-wrap items-center gap-2"
              role="presentation"
              aria-hidden
            >
              {STYLE_THEME_CHIPS[intake.style].map((chipClass, index) => (
                <span key={`${intake.style}-${index}`} className={chipClass} />
              ))}
            </div>
            <p className={`${sectionHint} mt-2`}>
              Preview only — final colors can still come from the customer brand.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="intake-instructions" className={labelClass}>
            Special instructions
          </label>
          <textarea
            id="intake-instructions"
            name="specialInstructions"
            rows={3}
            className={`${fieldClass} resize-y font-sans`}
            value={intake.instructions}
            onChange={(e) => onIntakeChange({ instructions: e.target.value })}
            placeholder="Sizing, event dates, must-haves…"
          />
        </div>

        <div
          className="rounded-md border border-dashed border-zinc-300 bg-white/90 px-2.5 py-2 text-xs leading-snug text-zinc-700"
          aria-live="polite"
        >
          <p className={`${subLabel} mb-1.5`}>Selected for design (live)</p>
          <p>
            <span className="font-semibold text-zinc-500">Category:</span>{" "}
            {intake.category}
          </p>
          <p>
            <span className="font-semibold text-zinc-500">Style:</span>{" "}
            {intake.style}
          </p>
          <p>
            <span className="font-semibold text-zinc-500">Components:</span>{" "}
            {selectedComponents.length > 0
              ? selectedComponents.join(" · ")
              : "— none —"}
          </p>
          <p>
            <span className="font-semibold text-zinc-500">Extracted:</span>{" "}
            {!intake.showExtracted
              ? "Run Analyze Website to load fields"
              : selectedExtractedLabels.length > 0
                ? selectedExtractedLabels.join(" · ")
                : "— none checked / empty —"}
          </p>
        </div>

        <div>
          <p id="intake-components-heading" className={subLabel}>
            Product components
          </p>
          <ul
            className="mt-1.5 space-y-1.5"
            aria-labelledby="intake-components-heading"
          >
            {activeComponents.map((name, index) => {
              const checked =
                intake.category === "Outdoor tent"
                  ? intake.componentsOutdoor[name as OutdoorComponent]
                  : intake.componentsBooth[name as BoothComponent];
              const compSlug =
                intake.category === "Outdoor tent" ? "outdoor" : "booth";
              const inputId = `intake-product-component-${compSlug}-${index}`;
              return (
                <li
                  key={name}
                  className="flex min-h-11 items-center gap-3 sm:min-h-0 sm:gap-2"
                >
                  <input
                    id={inputId}
                    name={`productComponent_${compSlug}_${index}`}
                    type="checkbox"
                    className="size-4 shrink-0 cursor-pointer rounded border-zinc-300 text-zinc-900 sm:size-3.5"
                    checked={checked}
                    onChange={(e) => toggleComponent(name, e.target.checked)}
                  />
                  <label
                    htmlFor={inputId}
                    className="flex-1 cursor-pointer py-1 text-sm leading-snug text-zinc-700"
                  >
                    {name}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <button
          type="button"
          className="min-h-11 w-full cursor-pointer rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 touch-manipulation"
          onClick={analyzeWebsite}
        >
          Analyze Website
        </button>
        <p className={sectionHint}>
          Loads mock extracted fields (no real scraping). Run after URL and name look right.
        </p>
      </section>

      {/* B — Review extracted content */}
      <section
        className="space-y-3 px-3 py-4 sm:px-4"
        aria-labelledby="section-extracted"
      >
        <div>
          <h2 id="section-extracted" className={sectionHeading}>
            Review extracted content
          </h2>
          <p className={`mt-1 ${sectionHint}`}>
            Toggle rows and edit text; checked items feed the brief and canvas.
          </p>
        </div>
        {intake.showExtracted ? (
          <div className="rounded-md border border-zinc-200 bg-white">
            <div className="space-y-2 px-2.5 py-2 sm:px-3">
              {(Object.keys(EXTRACTED_LABELS) as ExtractedKey[]).map((key) => {
                const row = intake.extracted[key];
                const includeId = `intake-extracted-include-${key}`;
                const valueId = `intake-extracted-value-${key}`;
                return (
                  <div
                    key={key}
                    className="flex gap-3 rounded border border-zinc-100 bg-zinc-50/80 p-3 sm:gap-2 sm:p-2"
                  >
                    <input
                      id={includeId}
                      name={`extractedInclude_${key}`}
                      type="checkbox"
                      className="mt-1 size-4 shrink-0 cursor-pointer rounded border-zinc-300 text-zinc-900 sm:size-3.5"
                      checked={row.useForDesign}
                      aria-label={`Include ${EXTRACTED_LABELS[key]} on design`}
                      onChange={(e) =>
                        setExtractedUse(key, e.target.checked)
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor={valueId}
                        className="text-xs font-medium text-zinc-600"
                      >
                        {EXTRACTED_LABELS[key]}
                      </label>
                      <textarea
                        id={valueId}
                        name={`extractedValue_${key}`}
                        rows={2}
                        className="mt-0.5 w-full min-w-0 cursor-text resize-y rounded border border-zinc-200 bg-white px-2 py-2 text-base leading-snug text-zinc-800 outline-none focus:border-zinc-400 sm:px-1.5 sm:py-1 sm:text-xs"
                        value={row.value}
                        onChange={(e) => setExtractedValue(key, e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className={sectionHint}>Use Analyze Website above to populate this section.</p>
        )}
      </section>

      {/* C — Design brief */}
      <section className="space-y-3 px-3 py-4 sm:px-4" aria-labelledby="section-brief">
        <div>
          <h2 id="section-brief" className={sectionHeading}>
            Design brief
          </h2>
          <p className={`mt-1 ${sectionHint}`}>
            Updates live from the form. Refresh re-syncs the brief text from your current selections.
          </p>
        </div>
        <button
          type="button"
          className="relative z-10 min-h-11 w-full cursor-pointer rounded-md border-2 border-zinc-900 bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-950 hover:shadow-lg active:translate-y-px touch-manipulation sm:min-h-0 sm:py-2.5"
          onClick={onRefreshDesignBrief}
        >
          Refresh Design Brief
        </button>
        <div>
          <label htmlFor="intake-design-brief" className={subLabel}>
            Brief text
          </label>
          <textarea
            id="intake-design-brief"
            name="designBrief"
            rows={10}
            className="mt-1 w-full min-w-0 cursor-text resize-y rounded-md border border-zinc-200 bg-white p-3 font-mono text-xs leading-relaxed text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300 sm:p-2 sm:text-[11px]"
            value={intake.designBrief}
            onChange={(e) => onIntakeChange({ designBrief: e.target.value })}
          />
        </div>
      </section>
    </div>
  );
}
