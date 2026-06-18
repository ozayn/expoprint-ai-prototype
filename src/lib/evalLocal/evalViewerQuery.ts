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
  /** URL inventory quick filter: recent | not_run | failed (omit for all). */
  inventory?: string;
  /** When "1" or "show", show all URL variant rows (skip canonical-domain collapse). */
  variants?: string;
  /** URL path type filter: root | shallow | deep */
  urlType?: string;
};

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

/** Default inventory view: recently processed first. */
export function defaultInventoryViewerQuery(
  current: EvalViewerQueryParams,
): EvalViewerQueryParams {
  return {
    ...current,
    view: "inventory",
    sort: current.sort ?? "recent",
  };
}
