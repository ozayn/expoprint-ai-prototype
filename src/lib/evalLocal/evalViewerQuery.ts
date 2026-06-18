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
  return next;
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
