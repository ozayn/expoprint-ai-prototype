"use client";

import { useCallback, useMemo, useState } from "react";

export type ProductCategory = "Outdoor tent" | "Trade show booth";
export type StylePreference = "Modern" | "Conservative" | "Traditional" | "Playful";

const OUTDOOR_COMPONENTS = [
  "Canopy tent",
  "Back wall",
  "Side wall",
  "Flag",
] as const;

const BOOTH_COMPONENTS = [
  "Backdrop",
  "Counter",
  "Header",
  "Product/service panels",
] as const;

type ExtractedKey =
  | "logo"
  | "brandColors"
  | "phone"
  | "email"
  | "address"
  | "social"
  | "services"
  | "products";

const EXTRACTED_LABELS: Record<ExtractedKey, string> = {
  logo: "Logo found",
  brandColors: "Brand colors",
  phone: "Phone number",
  email: "Email",
  address: "Address",
  social: "Social media",
  services: "Services",
  products: "Products",
};

type ExtractedRow = { value: string; useForDesign: boolean };

/** Default rows before “Analyze Website”; unchecked until mock data exists. */
function emptyExtracted(): Record<ExtractedKey, ExtractedRow> {
  return {
    logo: { value: "", useForDesign: false },
    brandColors: { value: "", useForDesign: false },
    phone: { value: "", useForDesign: false },
    email: { value: "", useForDesign: false },
    address: { value: "", useForDesign: false },
    social: { value: "", useForDesign: false },
    services: { value: "", useForDesign: false },
    products: { value: "", useForDesign: false },
  };
}

/** Mock extraction with sensible defaults: core brand/contact fields on for the demo. */
function buildMockExtracted(): Record<ExtractedKey, ExtractedRow> {
  const defaults: Record<ExtractedKey, boolean> = {
    logo: true,
    brandColors: true,
    phone: true,
    email: true,
    address: false,
    social: true,
    services: true,
    products: true,
  };
  const next = emptyExtracted();
  (Object.keys(MOCK_EXTRACTED) as ExtractedKey[]).forEach((key) => {
    next[key] = {
      value: MOCK_EXTRACTED[key],
      useForDesign: defaults[key],
    };
  });
  return next;
}

const MOCK_EXTRACTED: Record<ExtractedKey, string> = {
  logo: "SVG mark detected (mock) — “EB” monogram",
  brandColors: "Primary #0B2E4A · Accent #2BB3A3 · Neutral #F4F4F5",
  phone: "(555) 010-2030",
  email: "hello@examplebrand.com",
  address: "123 Display Ave, Austin, TX 78701",
  social: "linkedin.com/company/exampleco · instagram.com/exampleco",
  services: "Custom trade displays, event branding, install & teardown",
  products: "10×10 canopy tents, modular booths, backlit headers",
};

const fieldClass =
  "mt-1 w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300";
const labelClass = "text-xs font-medium text-zinc-600";
const sectionTitle = "text-sm font-semibold text-zinc-900";
const subLabel = "text-[11px] font-medium uppercase tracking-wide text-zinc-400";

export function DesignIntakePanel() {
  const [websiteUrl, setWebsiteUrl] = useState("https://examplebrand.com");
  const [businessName, setBusinessName] = useState("Example Brand Co.");
  const [category, setCategory] = useState<ProductCategory>("Outdoor tent");
  const [style, setStyle] = useState<StylePreference>("Modern");
  const [instructions, setInstructions] = useState("");

  const [componentsOutdoor, setComponentsOutdoor] = useState<
    Record<(typeof OUTDOOR_COMPONENTS)[number], boolean>
  >({
    "Canopy tent": true,
    "Back wall": false,
    "Side wall": false,
    Flag: false,
  });

  const [componentsBooth, setComponentsBooth] = useState<
    Record<(typeof BOOTH_COMPONENTS)[number], boolean>
  >({
    Backdrop: true,
    Counter: false,
    Header: false,
    "Product/service panels": false,
  });

  const [extracted, setExtracted] = useState<Record<ExtractedKey, ExtractedRow>>(
    () => emptyExtracted(),
  );
  const [showExtracted, setShowExtracted] = useState(false);
  const [designBrief, setDesignBrief] = useState("");

  const activeComponents = useMemo(() => {
    return category === "Outdoor tent"
      ? OUTDOOR_COMPONENTS
      : BOOTH_COMPONENTS;
  }, [category]);

  const toggleComponent = useCallback(
    (name: string, checked: boolean) => {
      if (category === "Outdoor tent") {
        setComponentsOutdoor((prev) => ({
          ...prev,
          [name as (typeof OUTDOOR_COMPONENTS)[number]]: checked,
        }));
      } else {
        setComponentsBooth((prev) => ({
          ...prev,
          [name as (typeof BOOTH_COMPONENTS)[number]]: checked,
        }));
      }
    },
    [category],
  );

  const analyzeWebsite = useCallback(() => {
    setExtracted(buildMockExtracted());
    setShowExtracted(true);
  }, []);

  const setExtractedValue = useCallback((key: ExtractedKey, value: string) => {
    setExtracted((prev) => ({
      ...prev,
      [key]: { ...prev[key], value },
    }));
  }, []);

  const setExtractedUse = useCallback((key: ExtractedKey, useForDesign: boolean) => {
    setExtracted((prev) => ({
      ...prev,
      [key]: { ...prev[key], useForDesign },
    }));
  }, []);

  const generateDesignBrief = useCallback(() => {
    const autoAnalyze = !showExtracted;
    const effectiveExtracted = autoAnalyze ? buildMockExtracted() : extracted;
    if (autoAnalyze) {
      setExtracted(buildMockExtracted());
      setShowExtracted(true);
    }

    const selectedComponents =
      category === "Outdoor tent"
        ? OUTDOOR_COMPONENTS.filter((c) => componentsOutdoor[c])
        : BOOTH_COMPONENTS.filter((c) => componentsBooth[c]);

    const lines: string[] = [
      "DESIGN BRIEF (prototype — mock extraction)",
      "================================",
      "",
      `Business: ${businessName.trim() || "(not provided)"}`,
      `Website: ${websiteUrl.trim() || "(not provided)"}`,
      `Product category: ${category}`,
      `Style preference: ${style}`,
      "",
      "Requested product components:",
      selectedComponents.length
        ? selectedComponents.map((c) => `  • ${c}`).join("\n")
        : "  (none selected)",
      "",
    ];

    if (instructions.trim()) {
      lines.push("Customer / special instructions:");
      lines.push(instructions.trim());
      lines.push("");
    }

    lines.push("Selected extracted content (for design use):");
    const selectedExtractedLines: string[] = [];
    (Object.keys(EXTRACTED_LABELS) as ExtractedKey[]).forEach((key) => {
      const row = effectiveExtracted[key];
      if (!row.useForDesign || !row.value.trim()) return;
      selectedExtractedLines.push(
        `  • ${EXTRACTED_LABELS[key]}: ${row.value.trim()}`,
      );
    });
    if (selectedExtractedLines.length === 0) {
      lines.push("  No extracted content selected yet");
    } else {
      lines.push(...selectedExtractedLines);
    }

    lines.push("");
    lines.push("— End of brief —");

    setDesignBrief(lines.join("\n"));
  }, [
    businessName,
    category,
    componentsBooth,
    componentsOutdoor,
    extracted,
    instructions,
    showExtracted,
    style,
    websiteUrl,
  ]);

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

        <div className="space-y-3 border-t border-zinc-100 px-3 pb-3 pt-2">
          <div>
            <label htmlFor="intake-website" className={labelClass}>
              Business website URL
            </label>
            <input
              id="intake-website"
              type="url"
              className={fieldClass}
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div>
            <label htmlFor="intake-name" className={labelClass}>
              Business name
            </label>
            <input
              id="intake-name"
              type="text"
              className={fieldClass}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="intake-category" className={labelClass}>
              Product category
            </label>
            <select
              id="intake-category"
              className={fieldClass}
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as ProductCategory)
              }
            >
              <option>Outdoor tent</option>
              <option>Trade show booth</option>
            </select>
          </div>
          <div>
            <label htmlFor="intake-style" className={labelClass}>
              Style preference
            </label>
            <select
              id="intake-style"
              className={fieldClass}
              value={style}
              onChange={(e) =>
                setStyle(e.target.value as StylePreference)
              }
            >
              <option>Modern</option>
              <option>Conservative</option>
              <option>Traditional</option>
              <option>Playful</option>
            </select>
          </div>
          <div>
            <label htmlFor="intake-instructions" className={labelClass}>
              Special instructions
            </label>
            <textarea
              id="intake-instructions"
              rows={3}
              className={`${fieldClass} resize-y font-sans`}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Sizing, event dates, must-haves…"
            />
          </div>

          <div>
            <p className={subLabel}>Product components</p>
            <ul className="mt-1.5 space-y-1.5">
              {activeComponents.map((name) => {
                const checked =
                  category === "Outdoor tent"
                    ? componentsOutdoor[name as (typeof OUTDOOR_COMPONENTS)[number]]
                    : componentsBooth[name as (typeof BOOTH_COMPONENTS)[number]];
                return (
                  <li key={name} className="flex items-center gap-2">
                    <input
                      id={`comp-${name}`}
                      type="checkbox"
                      className="size-3.5 rounded border-zinc-300 text-zinc-900"
                      checked={checked}
                      onChange={(e) =>
                        toggleComponent(name, e.target.checked)
                      }
                    />
                    <label
                      htmlFor={`comp-${name}`}
                      className="text-sm text-zinc-700"
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
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50"
            onClick={analyzeWebsite}
          >
            Analyze Website
          </button>

          {showExtracted ? (
            <details open className="rounded-md border border-zinc-200 bg-white">
              <summary className="cursor-pointer list-none px-2.5 py-2 text-sm font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden">
                Extracted design content
                <span className="ml-1 text-xs font-normal text-zinc-400">
                  (editable — check items to include)
                </span>
              </summary>
              <div className="space-y-2 border-t border-zinc-100 px-2.5 py-2">
                {(Object.keys(EXTRACTED_LABELS) as ExtractedKey[]).map((key) => {
                  const row = extracted[key];
                  return (
                    <div
                      key={key}
                      className="flex gap-2 rounded border border-zinc-100 bg-zinc-50/80 p-2"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 size-3.5 shrink-0 rounded border-zinc-300 text-zinc-900"
                        checked={row.useForDesign}
                        onChange={(e) =>
                          setExtractedUse(key, e.target.checked)
                        }
                        aria-label={`Use ${EXTRACTED_LABELS[key]} on design`}
                      />
                      <div className="min-w-0 flex-1">
                        <label className="text-xs font-medium text-zinc-600">
                          {EXTRACTED_LABELS[key]}
                        </label>
                        <textarea
                          rows={2}
                          className="mt-0.5 w-full resize-y rounded border border-zinc-200 bg-white px-1.5 py-1 text-xs leading-snug text-zinc-800 outline-none focus:border-zinc-400"
                          value={row.value}
                          onChange={(e) => setExtractedValue(key, e.target.value)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          ) : null}

          <button
            type="button"
            className="w-full rounded-md border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-950"
            onClick={generateDesignBrief}
          >
            Generate Design Brief
          </button>

          {designBrief ? (
            <div>
              <p className={subLabel}>Design brief</p>
              <textarea
                rows={12}
                className="mt-1 w-full resize-y rounded-md border border-zinc-200 bg-white p-2 font-mono text-[11px] leading-relaxed text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300"
                value={designBrief}
                onChange={(e) => setDesignBrief(e.target.value)}
              />
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}
