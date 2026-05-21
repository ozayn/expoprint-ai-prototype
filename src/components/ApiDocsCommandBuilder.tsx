"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { CopyCommandBlock } from "@/components/CopyCommandBlock";

const LOCAL_ORIGIN = "http://localhost:3000";

function extractApiUrl(origin: string): string {
  return `${origin}/api/design-intake/extract`;
}

function subscribePageOrigin() {
  return () => {};
}

function getPageOriginSnapshot(): string {
  return window.location.origin;
}

function getPageOriginServerSnapshot(): string {
  return LOCAL_ORIGIN;
}

const PRODUCT_CATEGORIES = ["Outdoor tent", "Trade show booth"] as const;
type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

const STYLES = ["Modern", "Conservative", "Traditional", "Playful"] as const;
type StylePreference = (typeof STYLES)[number];

const COMPONENT_OPTIONS: Record<ProductCategory, string[]> = {
  "Outdoor tent": ["Canopy tent", "Back wall", "Side wall", "Flag"],
  "Trade show booth": ["Backdrop", "Counter", "Header", "Product/service panels"],
};

const DEFAULT_COMPONENTS: Record<ProductCategory, string[]> = {
  "Outdoor tent": ["Canopy tent"],
  "Trade show booth": ["Backdrop"],
};

type ExtractPayload = {
  websiteUrl: string;
  productCategory: string;
  components: string[];
  stylePreference: string;
  customerInstructions?: string;
};

function escapeForBashSingleQuoted(json: string): string {
  return json.replace(/'/g, "'\\''");
}

function buildExtractPayload(
  websiteUrl: string,
  productCategory: ProductCategory,
  components: string[],
  stylePreference: StylePreference,
  customerInstructions: string,
): ExtractPayload {
  const payload: ExtractPayload = {
    websiteUrl: websiteUrl.trim() || "https://expoprint.io",
    productCategory,
    components: components.length > 0 ? components : DEFAULT_COMPONENTS[productCategory],
    stylePreference,
  };
  const instructions = customerInstructions.trim();
  if (instructions) payload.customerInstructions = instructions;
  return payload;
}

function buildCurlCommand(payload: ExtractPayload, extractUrl: string): string {
  const json = JSON.stringify(payload, null, 2);
  const escaped = escapeForBashSingleQuoted(json);
  return `curl -sS -X POST "${extractUrl}" \\
  -H "Content-Type: application/json" \\
  -d '${escaped}' | jq`;
}

function buildNpmCommand(
  websiteUrl: string,
  productCategory: ProductCategory,
  stylePreference: StylePreference,
): string {
  const url = websiteUrl.trim() || "https://expoprint.io";
  return `npm run api:test -- ${url} "${productCategory}" "${stylePreference}"`;
}

/** True when `api:test` / shell script payload matches the form (script is URL + category + style only). */
function npmMatchesFormPayload(payload: ExtractPayload): boolean {
  if (payload.customerInstructions) return false;
  if (payload.productCategory !== "Outdoor tent") return false;
  return (
    payload.components.length === 1 && payload.components[0] === "Canopy tent"
  );
}

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400";
const labelClass = "text-xs font-medium text-zinc-600";

export function ApiDocsCommandBuilder() {
  const apiOrigin = useSyncExternalStore(
    subscribePageOrigin,
    getPageOriginSnapshot,
    getPageOriginServerSnapshot,
  );
  const [websiteUrl, setWebsiteUrl] = useState("https://expoprint.io");
  const [productCategory, setProductCategory] =
    useState<ProductCategory>("Outdoor tent");
  const [stylePreference, setStylePreference] = useState<StylePreference>("Modern");
  const [components, setComponents] = useState<string[]>([
    ...DEFAULT_COMPONENTS["Outdoor tent"],
  ]);
  const [customerInstructions, setCustomerInstructions] = useState("");

  const extractUrl = useMemo(() => extractApiUrl(apiOrigin), [apiOrigin]);

  const onCategoryChange = useCallback((next: ProductCategory) => {
    setProductCategory(next);
    setComponents([...DEFAULT_COMPONENTS[next]]);
  }, []);

  const toggleComponent = useCallback((name: string) => {
    setComponents((prev) => {
      if (prev.includes(name)) {
        const next = prev.filter((c) => c !== name);
        return next.length > 0 ? next : prev;
      }
      return [...prev, name];
    });
  }, []);

  const payload = useMemo(
    () =>
      buildExtractPayload(
        websiteUrl,
        productCategory,
        components,
        stylePreference,
        customerInstructions,
      ),
    [websiteUrl, productCategory, components, stylePreference, customerInstructions],
  );

  const curlCommand = useMemo(
    () => buildCurlCommand(payload, extractUrl),
    [payload, extractUrl],
  );
  const npmCommand = useMemo(
    () => buildNpmCommand(websiteUrl, productCategory, stylePreference),
    [websiteUrl, productCategory, stylePreference],
  );
  const npmLimited = !npmMatchesFormPayload(payload);

  const componentOptions = COMPONENT_OPTIONS[productCategory];

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-zinc-900">Try it locally</h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600">
        Make sure the local dev server is running before using these commands (
        <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
          npm run dev
        </code>{" "}
        or{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
          npm run dev:local
        </code>
        ). Commands below update from the form. Use{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">jq</code>{" "}
        with curl for pretty-printed JSON.
      </p>

      <form
        className="mt-5 grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="sm:col-span-2">
          <label htmlFor="api-docs-url" className={labelClass}>
            Website URL
          </label>
          <input
            id="api-docs-url"
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://expoprint.io"
            className={inputClass}
            autoComplete="url"
          />
        </div>

        <div>
          <label htmlFor="api-docs-category" className={labelClass}>
            Product category
          </label>
          <select
            id="api-docs-category"
            value={productCategory}
            onChange={(e) => onCategoryChange(e.target.value as ProductCategory)}
            className={inputClass}
          >
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="api-docs-style" className={labelClass}>
            Style preference
          </label>
          <select
            id="api-docs-style"
            value={stylePreference}
            onChange={(e) => setStylePreference(e.target.value as StylePreference)}
            className={inputClass}
          >
            {STYLES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="sm:col-span-2">
          <legend className={labelClass}>Components</legend>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {componentOptions.map((name) => (
              <li key={name}>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={components.includes(name)}
                    onChange={() => toggleComponent(name)}
                    className="size-4 rounded border-zinc-300 text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
                  />
                  {name}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <div className="sm:col-span-2">
          <label htmlFor="api-docs-instructions" className={labelClass}>
            Customer instructions{" "}
            <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <textarea
            id="api-docs-instructions"
            value={customerInstructions}
            onChange={(e) => setCustomerInstructions(e.target.value)}
            rows={2}
            placeholder="Factual hints for Claude, if any"
            className={`${inputClass} resize-y`}
          />
        </div>
      </form>

      <div className="mt-5 flex flex-col gap-4">
        <CopyCommandBlock label="curl" command={curlCommand} />
        <CopyCommandBlock label="npm script" command={npmCommand} />
        <p className="text-xs leading-relaxed text-zinc-500">
          The npm script is for local development. The curl command above uses the
          current page&apos;s domain ({apiOrigin}).
        </p>
      </div>

      {npmLimited ? (
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          The{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px]">
            api:test
          </code>{" "}
          helper only passes URL, product category, and style. It always sends{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px]">
            components: [&quot;Canopy tent&quot;]
          </code>{" "}
          and omits customer instructions — use the curl command for your full
          payload.
        </p>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px]">
            api:test
          </code>{" "}
          matches this form (Outdoor tent, Canopy tent only, no extra instructions).
        </p>
      )}

      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
        Shell:{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px]">
          ./scripts/test-design-intake-api.sh &lt;url&gt; [category] [style]
        </code>{" "}
        — same limits as{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[11px]">
          api:test
        </code>
        .
      </p>
    </section>
  );
}
