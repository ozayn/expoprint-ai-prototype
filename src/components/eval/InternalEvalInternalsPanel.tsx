type Props = {
  reviewRowCount: number;
  urlInventoryRowCount?: number;
  urlInventoryIncluded: boolean;
  sourceReviewQueue?: string;
  sourceUrlCandidates?: string;
  publishedAt?: string;
};

export function InternalEvalInternalsPanel({
  reviewRowCount,
  urlInventoryRowCount,
  urlInventoryIncluded,
  sourceReviewQueue,
  sourceUrlCandidates,
  publishedAt,
}: Props) {
  return (
    <details className="mt-14 border-t border-zinc-200/60 pt-6">
      <summary className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-700">
        Evaluation internals
      </summary>

      <div className="mt-6 space-y-3 text-sm text-zinc-600">
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Published review rows
            </dt>
            <dd className="mt-0.5 font-mono text-xs text-zinc-700">
              {reviewRowCount.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Published URL inventory rows
            </dt>
            <dd className="mt-0.5 font-mono text-xs text-zinc-700">
              {urlInventoryIncluded
                ? (urlInventoryRowCount ?? 0).toLocaleString()
                : "Not included"}
            </dd>
          </div>
          {sourceReviewQueue ? (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Review dataset source
              </dt>
              <dd className="mt-0.5 font-mono text-xs text-zinc-600">
                {sourceReviewQueue}
              </dd>
            </div>
          ) : null}
          {urlInventoryIncluded && sourceUrlCandidates ? (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                URL inventory source
              </dt>
              <dd className="mt-0.5 font-mono text-xs text-zinc-600">
                {sourceUrlCandidates}
              </dd>
            </div>
          ) : null}
          {publishedAt ? (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Generated at
              </dt>
              <dd className="mt-0.5 text-xs text-zinc-600">
                <time dateTime={publishedAt}>
                  {new Date(publishedAt).toLocaleString()}
                </time>
              </dd>
            </div>
          ) : null}
        </dl>

        {!urlInventoryIncluded ? (
          <p className="text-xs leading-relaxed text-zinc-500">
            URL inventory was not included in the published dataset.
          </p>
        ) : null}
      </div>
    </details>
  );
}
