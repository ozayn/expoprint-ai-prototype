"use client";

import Link from "next/link";
import {
  buildEvalViewerHref,
  patchEvalViewerQuery,
  showUrlInventoryVariants,
  type EvalViewerQueryParams,
} from "@/lib/evalLocal/evalViewerQuery";
import {
  parseUrlInventoryQuickFilter,
  parseUrlInventorySortMode,
  URL_INVENTORY_SORT_MODES,
  urlInventorySortLabel,
  type UrlInventoryQuickFilter,
} from "@/lib/evalLocal/urlInventorySort";

type Props = {
  basePath: string;
  searchParams: EvalViewerQueryParams;
};

const QUICK_FILTERS: { id: UrlInventoryQuickFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "recent", label: "Recently processed" },
  { id: "not_run", label: "Not run" },
  { id: "failed", label: "Failed" },
];

export function UrlInventoryToolbar({ basePath, searchParams }: Props) {
  const sortMode = parseUrlInventorySortMode(
    searchParams.sort ?? "recent",
  );
  const quickFilter = parseUrlInventoryQuickFilter(searchParams.inventory);
  const showVariants = showUrlInventoryVariants(searchParams);

  function hrefForQuickFilter(filter: UrlInventoryQuickFilter): string {
    const next = patchEvalViewerQuery(
      { ...searchParams, view: "inventory" },
      {
        inventory: filter === "all" ? "" : filter,
      },
    );
    return buildEvalViewerHref(basePath, next);
  }

  function hrefForSort(sort: string): string {
    const next = patchEvalViewerQuery(
      { ...searchParams, view: "inventory" },
      { sort },
    );
    return buildEvalViewerHref(basePath, next);
  }

  function hrefForVariantsToggle(): string {
    const next = patchEvalViewerQuery(
      { ...searchParams, view: "inventory" },
      { variants: showVariants ? "" : "1" },
    );
    return buildEvalViewerHref(basePath, next);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-1.5">
        {QUICK_FILTERS.map(({ id, label }) => (
          <Link
            key={id}
            href={hrefForQuickFilter(id)}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
              quickFilter === id
                ? "bg-zinc-200/80 text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <label className="flex items-center gap-1.5 text-xs text-zinc-500">
        <span className="text-zinc-400">Sort</span>
        <select
          value={sortMode}
          onChange={(e) => {
            window.location.href = hrefForSort(e.target.value);
          }}
          className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 focus:border-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-200"
          aria-label="Sort URL inventory"
        >
          {URL_INVENTORY_SORT_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {urlInventorySortLabel(mode)}
            </option>
          ))}
        </select>
      </label>

      <Link
        href={hrefForVariantsToggle()}
        className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
          showVariants
            ? "bg-zinc-200/80 text-zinc-900"
            : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
        }`}
      >
        {showVariants ? "Hide duplicate variants" : "Show duplicate URL variants"}
      </Link>
    </div>
  );
}
