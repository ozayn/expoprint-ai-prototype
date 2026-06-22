import type { EvalStatusFilter } from "./evalRowFilters";
import { normalizeStatusValue } from "./normalizeEvalStatus";

/** Query params for the canonical eval viewer at `/internal/eval`. */
export type EvalViewerQueryParams = {
  summary?: string;
  review?: string;
  score?: string;
  /** URL candidates inventory file (`url_candidates_*.csv`). */
  urls?: string;
  /** @deprecated Prefer `urls`. */
  candidates?: string;
  view?: string;
  /** URL inventory sort: recent | original | domain | status | needs_work */
  sort?: string;
  /** Status filter: success | failed | not_run (omit for all). */
  status?: string;
  /** URL inventory quick filter: recent (omit for all). Legacy: not_run | failed map to status. */
  inventory?: string;
  /** When "1" or "show", show all URL variant rows (skip canonical-domain collapse). */
  variants?: string;
  /** URL path type filter: root | shallow | deep */
  urlType?: string;
};

export type EvalViewMode = "gallery" | "table" | "inventory";

/**
 * Resolves the active eval viewer tab from the `view` query param.
 * Defaults to All URLs when inventory exists; otherwise Gallery.
 */
export function resolveEvalViewMode(
  viewParam: string | undefined,
  hasUrlInventory: boolean,
): EvalViewMode {
  const view = viewParam?.trim();
  if (view === "table") return "table";
  if (view === "gallery") return "gallery";
  if (view === "inventory") {
    return hasUrlInventory ? "inventory" : "gallery";
  }
  if (hasUrlInventory) return "inventory";
  return "gallery";
}

export function resolveUrlCandidatesParam(
  params: EvalViewerQueryParams,
): string | undefined {
  const urls = params.urls?.trim();
  if (urls) return urls;
  const candidates = params.candidates?.trim();
  return candidates || undefined;
}

export function buildEvalViewerHref(
  basePath: string,
  params: EvalViewerQueryParams,
): string {
  const q = buildEvalViewerQueryString(params);
  const qs = q.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function buildEvalViewerQueryString(
  params: EvalViewerQueryParams,
): URLSearchParams {
  const q = new URLSearchParams();
  if (params.summary) q.set("summary", params.summary);
  if (params.review) q.set("review", params.review);
  if (params.score) q.set("score", params.score);

  const urls = resolveUrlCandidatesParam(params);
  if (urls) q.set("urls", urls);

  if (params.view === "table") q.set("view", "table");
  if (params.view === "inventory") q.set("view", "inventory");

  const sort = params.sort?.trim();
  if (sort) q.set("sort", sort);

  const status = params.status?.trim();
  if (status) q.set("status", status);

  const inventory = params.inventory?.trim();
  if (inventory) q.set("inventory", inventory);

  const variants = params.variants?.trim();
  if (variants) q.set("variants", variants);

  const urlType = params.urlType?.trim();
  if (urlType) q.set("urlType", urlType);

  return q;
}

export function patchEvalViewerQuery(
  current: EvalViewerQueryParams,
  patch: Partial<EvalViewerQueryParams>,
): EvalViewerQueryParams {
  const next: EvalViewerQueryParams = { ...current, ...patch };
  if (patch.urls !== undefined) {
    delete next.candidates;
  }
  if (patch.status === "" || patch.status === "all") {
    delete next.status;
  }
  if (patch.inventory === "" || patch.inventory === "all") {
    delete next.inventory;
  }
  if (patch.sort === "" || patch.sort === "recent") {
    delete next.sort;
  }
  if (patch.variants === "" || patch.variants === "0") {
    delete next.variants;
  }
  if (patch.urlType === "" || patch.urlType === "all") {
    delete next.urlType;
  }
  return next;
}

/** When "1" or "show", inventory shows all URL variant rows. */
export function showUrlInventoryVariants(
  params: EvalViewerQueryParams,
): boolean {
  const variants = params.variants?.trim().toLowerCase();
  return variants === "1" || variants === "show" || variants === "true";
}

/** Canonical link for opening the eval viewer on combined review + All URLs. */
export const EVAL_VIEWER_DEFAULT_HREF =
  "/internal/eval?review=combined&view=inventory&sort=recent";

export function defaultInventoryViewerQuery(
  current: EvalViewerQueryParams,
): EvalViewerQueryParams {
  return {
    ...current,
    view: "inventory",
    sort: current.sort ?? "recent",
  };
}

/** Parse ?status=success|failed|not_run (case-insensitive). */
export function parseEvalStatusParam(
  value: string | undefined,
): EvalStatusFilter {
  const v = value?.trim().toLowerCase().replace(/\s+/g, "_");
  if (!v || v === "all") return "all";
  const normalized = normalizeStatusValue(v);
  if (normalized === "success" || normalized === "failed" || normalized === "not_run") {
    return normalized;
  }
  return "all";
}

/**
 * Resolve status filter from ?status= or legacy ?inventory=not_run|failed.
 */
export function statusFilterFromQueryParams(
  params: EvalViewerQueryParams,
): EvalStatusFilter {
  const fromStatus = parseEvalStatusParam(params.status);
  if (fromStatus !== "all") return fromStatus;

  const inv = params.inventory?.trim().toLowerCase().replace(/\s+/g, "_");
  if (inv === "not_run") return "not_run";
  if (inv === "failed") return "failed";
  return "all";
}
