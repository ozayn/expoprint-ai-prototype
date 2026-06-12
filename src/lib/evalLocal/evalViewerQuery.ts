/** Query params shared by /dev/eval and /internal/eval viewers. */
export type EvalViewerQueryParams = {
  summary?: string;
  review?: string;
  score?: string;
  /** URL candidates inventory file (`url_candidates_*.csv`). */
  urls?: string;
  /** @deprecated Prefer `urls`. */
  candidates?: string;
  view?: string;
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
  return next;
}
