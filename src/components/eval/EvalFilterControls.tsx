"use client";

import { useRef } from "react";
import {
  FIELD_FILTER_OPTIONS,
  fieldFilterLabel,
  type FieldFilterId,
} from "@/lib/evalLocal/fieldCoverageHelpers";
import {
  useEvalViewerFilters,
  type EvalStatusFilter,
} from "./EvalViewerFilterContext";

function statusLabel(filter: EvalStatusFilter): string {
  if (filter === "all") return "All";
  if (filter === "not_run") return "Not run";
  if (filter === "success") return "Success";
  return "Failed";
}

type Props = {
  showNotRunStatus?: boolean;
  searchPlaceholder?: string;
  activeSummary?: string;
  resultCountLine?: string;
  processedMatchLine?: string;
};

export function EvalFilterControls({
  showNotRunStatus = true,
  searchPlaceholder = "Search domain, URL, project, business…",
  activeSummary,
  resultCountLine,
  processedMatchLine,
}: Props) {
  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    fieldFilters,
    addFieldFilter,
    removeFieldFilter,
    clearFieldFilters,
  } = useEvalViewerFilters();

  const selectRef = useRef<HTMLSelectElement>(null);

  const statusOptions: EvalStatusFilter[] = showNotRunStatus
    ? ["all", "not_run", "success", "failed"]
    : ["all", "success", "failed"];

  const availableOptions = FIELD_FILTER_OPTIONS.filter(
    (o) => !fieldFilters.includes(o.id),
  );

  const activeParts = [
    statusFilter !== "all" ? statusLabel(statusFilter) : null,
    ...fieldFilters.map((id) => fieldFilterLabel(id)),
  ].filter(Boolean);

  return (
    <div className="space-y-3" suppressHydrationWarning>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={searchPlaceholder}
        aria-label="Search rows"
        autoComplete="off"
        data-1p-ignore
        data-lpignore="true"
        data-form-type="other"
        suppressHydrationWarning
        className="w-full max-w-md rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-200"
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {statusOptions.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              suppressHydrationWarning
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                statusFilter === key
                  ? "bg-zinc-200/80 text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
              }`}
            >
              {statusLabel(key)}
            </button>
          ))}
        </div>

        <div className="relative">
          <select
            ref={selectRef}
            value=""
            suppressHydrationWarning
            onChange={(e) => {
              const id = e.target.value as FieldFilterId;
              if (id) addFieldFilter(id);
              e.target.value = "";
            }}
            disabled={availableOptions.length === 0}
            className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600 focus:border-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-200 disabled:opacity-50"
            aria-label="Add field filter"
          >
            <option value="">Add field filter</option>
            {availableOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {fieldFilters.length > 0 ? (
          <button
            type="button"
            onClick={clearFieldFilters}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {fieldFilters.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {fieldFilters.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => removeFieldFilter(id)}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 hover:bg-zinc-200/80"
            >
              {fieldFilterLabel(id)} ×
            </button>
          ))}
        </div>
      ) : null}

      {activeParts.length > 0 ? (
        <p className="text-xs text-zinc-500">
          <span className="text-zinc-400">Active:</span> {activeParts.join(" · ")}
        </p>
      ) : activeSummary ? (
        <p className="text-xs text-zinc-500">
          <span className="text-zinc-400">Active:</span> {activeSummary}
        </p>
      ) : null}

      {resultCountLine ? (
        <p className="text-xs text-zinc-500">{resultCountLine}</p>
      ) : null}
      {processedMatchLine ? (
        <p className="text-xs text-zinc-400">{processedMatchLine}</p>
      ) : null}
    </div>
  );
}
