"use client";

import { useCallback, useMemo, useState } from "react";
import { FabricPreviewCanvas } from "@/components/FabricPreviewCanvas";
import {
  API_TEST_WEBSITE_URL_EMPTY_MESSAGE,
  API_TEST_WEBSITE_URL_HELPER,
  normalizeApiTestWebsiteUrl,
} from "@/lib/apiTestWebsiteUrl";
import type {
  DesignIntakeExtractResponse,
  DesignIntakeExtractSuccess,
} from "@/lib/designIntakeApiSchema";
import { getSelectedProductComponents } from "@/lib/designIntakeState";
import {
  mapExtractApiResponseToIntake,
  type ExtractApiFormContext,
} from "@/lib/mapExtractApiResponseToIntake";

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

type RequestBody = {
  websiteUrl: string;
  productCategory: string;
  components: string[];
  stylePreference: string;
  customerInstructions?: string;
};

function buildRequestBody(
  normalizedWebsiteUrl: string,
  productCategory: ProductCategory,
  components: string[],
  stylePreference: StylePreference,
  customerInstructions: string,
): RequestBody {
  const body: RequestBody = {
    websiteUrl: normalizedWebsiteUrl,
    productCategory,
    components: components.length > 0 ? components : DEFAULT_COMPONENTS[productCategory],
    stylePreference,
  };
  const instructions = customerInstructions.trim();
  if (instructions) body.customerInstructions = instructions;
  return body;
}

type ResponseSummary = {
  ok: string;
  businessName: string;
  businessDomain: string;
  logoCount: string;
  servicesProducts: string;
  pagesInspected: string;
  claudeStatus: string;
  warningsCount: string;
};

function summarizeResponse(data: DesignIntakeExtractResponse): ResponseSummary {
  const business = "business" in data && data.business ? data.business : null;
  const brand = "brand" in data && data.brand ? data.brand : null;
  const content = "content" in data && data.content ? data.content : null;
  const metadata = data.metadata;

  const services = content?.services?.length ?? 0;
  const products = content?.products?.length ?? 0;

  return {
    ok: String(data.ok),
    businessName: business?.name?.trim() || "—",
    businessDomain: business?.domain?.trim() || "—",
    logoCount: String(brand?.logoCandidates?.length ?? 0),
    servicesProducts: `${services} services · ${products} products`,
    pagesInspected: String(metadata?.pagesInspected ?? "—"),
    claudeStatus: metadata?.claude?.status ?? "—",
    warningsCount: String(metadata?.warnings?.length ?? 0),
  };
}

const inputClass =
  "mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400";
const labelClass = "text-xs font-medium text-zinc-600";
const btnSecondary =
  "inline-flex min-h-9 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 disabled:cursor-not-allowed disabled:opacity-50";

export function DesignIntakeApiTester() {
  const [websiteUrl, setWebsiteUrl] = useState("https://expoprint.io");
  const [productCategory, setProductCategory] =
    useState<ProductCategory>("Outdoor tent");
  const [stylePreference, setStylePreference] = useState<StylePreference>("Modern");
  const [components, setComponents] = useState<string[]>([
    ...DEFAULT_COMPONENTS["Outdoor tent"],
  ]);
  const [customerInstructions, setCustomerInstructions] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<DesignIntakeExtractResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewSessionKey, setPreviewSessionKey] = useState(0);
  const [selectedPreviewLogoUrl, setSelectedPreviewLogoUrl] = useState("");

  const formContext = useMemo(
    (): ExtractApiFormContext => ({
      websiteUrl,
      productCategory,
      components,
      stylePreference,
      customerInstructions,
    }),
    [
      websiteUrl,
      productCategory,
      components,
      stylePreference,
      customerInstructions,
    ],
  );

  const successResponse =
    response?.ok === true ? (response as DesignIntakeExtractSuccess) : null;

  const previewIntake = useMemo(() => {
    if (!successResponse) return null;
    return mapExtractApiResponseToIntake(successResponse, formContext, {
      selectedLogoUrl: selectedPreviewLogoUrl,
    });
  }, [successResponse, formContext, selectedPreviewLogoUrl]);

  const previewSurface = useMemo(() => {
    if (!previewIntake) return null;
    const surfaces = getSelectedProductComponents(previewIntake);
    return surfaces[0] ?? null;
  }, [previewIntake]);

  const logoCandidates = successResponse?.brand.logoCandidates ?? [];

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

  const formattedJson = useMemo(
    () => (response ? JSON.stringify(response, null, 2) : ""),
    [response],
  );

  const summary = useMemo(
    () => (response ? summarizeResponse(response) : null),
    [response],
  );

  const normalizeWebsiteUrlField = useCallback(
    (options?: { rejectEmpty?: boolean }) => {
      const normalized = normalizeApiTestWebsiteUrl(websiteUrl);
      if (!normalized) {
        if (options?.rejectEmpty) {
          setUrlError(API_TEST_WEBSITE_URL_EMPTY_MESSAGE);
        }
        return null;
      }
      setUrlError(null);
      if (normalized !== websiteUrl) setWebsiteUrl(normalized);
      return normalized;
    },
    [websiteUrl],
  );

  const runExtraction = useCallback(async () => {
    const normalizedUrl = normalizeWebsiteUrlField({ rejectEmpty: true });
    if (!normalizedUrl) return;

    setLoading(true);
    setError(null);
    setCopied(false);

    const body = buildRequestBody(
      normalizedUrl,
      productCategory,
      components,
      stylePreference,
      customerInstructions,
    );

    try {
      const res = await fetch("/api/design-intake/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setResponse(null);
        setError(
          res.ok
            ? "Response was not valid JSON."
            : `HTTP ${res.status}: response was not valid JSON.`,
        );
        return;
      }

      const typed = parsed as DesignIntakeExtractResponse;
      setResponse(typed);

      if (typed.ok === true) {
        const topLogo = typed.brand.logoCandidates[0]?.url?.trim() ?? "";
        setSelectedPreviewLogoUrl(topLogo);
        setPreviewSessionKey((k) => k + 1);
      } else {
        setSelectedPreviewLogoUrl("");
      }

      if (!res.ok) {
        setError(`HTTP ${res.status} — see JSON body below.`);
      }
    } catch (err) {
      setResponse(null);
      setSelectedPreviewLogoUrl("");
      setError(
        err instanceof Error ? err.message : "Request failed. Is the dev server running?",
      );
    } finally {
      setLoading(false);
    }
  }, [
    normalizeWebsiteUrlField,
    productCategory,
    components,
    stylePreference,
    customerInstructions,
  ]);

  const onCopyJson = useCallback(async () => {
    if (!formattedJson) return;
    try {
      await navigator.clipboard.writeText(formattedJson);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [formattedJson]);

  const onClear = useCallback(() => {
    setResponse(null);
    setError(null);
    setCopied(false);
    setSelectedPreviewLogoUrl("");
    setPreviewSessionKey((k) => k + 1);
  }, []);

  const componentOptions = COMPONENT_OPTIONS[productCategory];

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Request</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Calls{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
            POST /api/design-intake/extract
          </code>{" "}
          on this host. Extraction may take up to a minute.
        </p>

        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void runExtraction();
          }}
        >
          <div className="sm:col-span-2">
            <label htmlFor="api-test-url" className={labelClass}>
              Website URL
            </label>
            <input
              id="api-test-url"
              type="text"
              inputMode="url"
              value={websiteUrl}
              onChange={(e) => {
                setWebsiteUrl(e.target.value);
                if (urlError) setUrlError(null);
              }}
              onBlur={() => {
                normalizeWebsiteUrlField();
              }}
              placeholder="expoprint.io or https://expoprint.io"
              className={inputClass}
              autoComplete="url"
              disabled={loading}
              aria-invalid={urlError ? true : undefined}
              aria-describedby="api-test-url-hint"
            />
            <p id="api-test-url-hint" className="mt-1.5 text-xs leading-snug text-zinc-500">
              {API_TEST_WEBSITE_URL_HELPER}
            </p>
            {urlError ? (
              <p className="mt-1.5 text-xs text-red-700" role="alert">
                {urlError}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="api-test-category" className={labelClass}>
              Product category
            </label>
            <select
              id="api-test-category"
              value={productCategory}
              onChange={(e) => onCategoryChange(e.target.value as ProductCategory)}
              className={inputClass}
              disabled={loading}
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="api-test-style" className={labelClass}>
              Style preference
            </label>
            <select
              id="api-test-style"
              value={stylePreference}
              onChange={(e) => setStylePreference(e.target.value as StylePreference)}
              className={inputClass}
              disabled={loading}
            >
              {STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="sm:col-span-2" disabled={loading}>
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
            <label htmlFor="api-test-instructions" className={labelClass}>
              Customer instructions{" "}
              <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <textarea
              id="api-test-instructions"
              value={customerInstructions}
              onChange={(e) => setCustomerInstructions(e.target.value)}
              rows={2}
              placeholder="Factual hints for Claude, if any"
              className={`${inputClass} resize-y`}
              disabled={loading}
            />
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Running extraction…" : "Run extraction API"}
            </button>
          </div>
        </form>
      </section>

      {(error || response) && (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-zinc-900">Response</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onCopyJson()}
                disabled={!formattedJson}
                className={btnSecondary}
              >
                {copied ? "Copied" : "Copy JSON"}
              </button>
              <button type="button" onClick={onClear} className={btnSecondary}>
                Clear response
              </button>
            </div>
          </div>

          {error && (
            <p
              className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              role="alert"
            >
              {error}
            </p>
          )}

          {summary && (
            <dl className="mt-4 grid gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-zinc-500">ok</dt>
                <dd className="font-mono text-zinc-900">{summary.ok}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">business.name</dt>
                <dd className="text-zinc-900">{summary.businessName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">business.domain</dt>
                <dd className="font-mono text-zinc-900">{summary.businessDomain}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">logo candidates</dt>
                <dd className="font-mono text-zinc-900">{summary.logoCount}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">content</dt>
                <dd className="text-zinc-900">{summary.servicesProducts}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">pages inspected</dt>
                <dd className="font-mono text-zinc-900">{summary.pagesInspected}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">Claude status</dt>
                <dd className="font-mono text-zinc-900">{summary.claudeStatus}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-zinc-500">warnings</dt>
                <dd className="font-mono text-zinc-900">{summary.warningsCount}</dd>
              </div>
            </dl>
          )}

          {successResponse && previewIntake && (
            <section className="mt-6 border-t border-zinc-100 pt-6">
              <h3 className="text-sm font-semibold text-zinc-900">Canvas preview</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                This canvas is a visual preview generated from the API response; JSON
                remains the integration output.
              </p>

              {logoCandidates.length > 0 ? (
                <div className="mt-3">
                  <label htmlFor="api-test-preview-logo" className={labelClass}>
                    Preview logo candidate
                  </label>
                  <select
                    id="api-test-preview-logo"
                    value={selectedPreviewLogoUrl}
                    onChange={(e) => setSelectedPreviewLogoUrl(e.target.value)}
                    className={inputClass}
                  >
                    {logoCandidates.map((candidate, index) => (
                      <option key={candidate.url} value={candidate.url}>
                        {index === 0 ? "Top ranked — " : ""}
                        {candidate.source}
                        {candidate.alt ? ` (${candidate.alt})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <FabricPreviewCanvas
                intake={previewIntake}
                surfaceLabel={previewSurface}
                sessionKey={previewSessionKey}
              />
            </section>
          )}

          {formattedJson && (
            <pre className="mt-4 max-h-[min(70vh,640px)] overflow-auto rounded-lg border border-zinc-200 bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-100">
              <code>{formattedJson}</code>
            </pre>
          )}
        </section>
      )}
    </div>
  );
}
