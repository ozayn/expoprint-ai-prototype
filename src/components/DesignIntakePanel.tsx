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

const fieldClass =
  "mt-1 w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300";
const labelClass = "text-xs font-medium text-zinc-600";
const sectionTitle = "text-sm font-semibold text-zinc-900";
const subLabel = "text-[11px] font-medium uppercase tracking-wide text-zinc-400";

export type DesignIntakePanelProps = {
  intake: DesignIntakeState;
  onIntakeChange: (patch: Partial<DesignIntakeState>) => void;
  onGenerateDesignBrief: () => void;
};

export function DesignIntakePanel({
  intake,
  onIntakeChange,
  onGenerateDesignBrief,
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
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/40">
      <details open className="group">
        <summary className="cursor-pointer select-none list-none px-3 py-2.5 [&::-webkit-details-marker]:hidden">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className={sectionTitle}>Design intake</h2>
              <p className="mt-0.5 text-xs leading-snug text-zinc-500">
                Phase 1 — gather inputs before canvas generation (mocked analysis).
              </p>
            </div>
            <span
              className="inline-block shrink-0 text-zinc-400 transition-transform group-open:rotate-180"
              aria-hidden
            >
              ▼
            </span>
          </div>
        </summary>

        <div className="relative z-0 space-y-3 border-t border-zinc-100 px-3 pb-3 pt-2">
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
                  <li key={name} className="flex items-center gap-2">
                    <input
                      id={inputId}
                      name={`productComponent_${compSlug}_${index}`}
                      type="checkbox"
                      className="size-3.5 shrink-0 cursor-pointer rounded border-zinc-300 text-zinc-900"
                      checked={checked}
                      onChange={(e) =>
                        toggleComponent(name, e.target.checked)
                      }
                    />
                    <label
                      htmlFor={inputId}
                      className="cursor-pointer text-sm text-zinc-700"
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
            className="w-full cursor-pointer rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
            onClick={analyzeWebsite}
          >
            Analyze Website
          </button>

          {intake.showExtracted ? (
            <div className="rounded-md border border-zinc-200 bg-white">
              <div className="border-b border-zinc-100 px-2.5 py-2 text-sm font-semibold text-zinc-900">
                Extracted design content
                <span className="ml-1 text-xs font-normal text-zinc-400">
                  (editable — check items to include)
                </span>
              </div>
              <div className="space-y-2 px-2.5 py-2">
                {(Object.keys(EXTRACTED_LABELS) as ExtractedKey[]).map((key) => {
                  const row = intake.extracted[key];
                  const includeId = `intake-extracted-include-${key}`;
                  const valueId = `intake-extracted-value-${key}`;
                  return (
                    <div
                      key={key}
                      className="flex gap-2 rounded border border-zinc-100 bg-zinc-50/80 p-2"
                    >
                      <input
                        id={includeId}
                        name={`extractedInclude_${key}`}
                        type="checkbox"
                        className="mt-1 size-3.5 shrink-0 cursor-pointer rounded border-zinc-300 text-zinc-900"
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
                          className="mt-0.5 w-full cursor-text resize-y rounded border border-zinc-200 bg-white px-1.5 py-1 text-xs leading-snug text-zinc-800 outline-none focus:border-zinc-400"
                          value={row.value}
                          onChange={(e) => setExtractedValue(key, e.target.value)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            className="relative z-20 w-full cursor-pointer rounded-md border-2 border-zinc-900 bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-zinc-950 hover:shadow-lg active:translate-y-px"
            onClick={onGenerateDesignBrief}
          >
            Generate Design Brief
          </button>

          {intake.designBrief ? (
            <div>
              <label htmlFor="intake-design-brief" className={subLabel}>
                Design brief
              </label>
              <textarea
                id="intake-design-brief"
                name="designBrief"
                rows={12}
                className="mt-1 w-full cursor-text resize-y rounded-md border border-zinc-200 bg-white p-2 font-mono text-[11px] leading-relaxed text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300"
                value={intake.designBrief}
                onChange={(e) => onIntakeChange({ designBrief: e.target.value })}
              />
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}
