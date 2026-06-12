"use client";

import Link from "next/link";
import type { EvalViewerSearchParams } from "./BrandAuditViewer";

export type EvalViewMode = "gallery" | "table";

function buildEvalHref(
  basePath: string,
  current: EvalViewerSearchParams,
  view: EvalViewMode,
): string {
  const q = new URLSearchParams();
  if (current.summary) q.set("summary", current.summary);
  if (current.review) q.set("review", current.review);
  if (current.score) q.set("score", current.score);
  if (view === "table") q.set("view", "table");
  const qs = q.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function viewToggleClass(active: boolean): string {
  return [
    "rounded-md px-3 py-1.5 text-sm transition-colors",
    "outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300",
    active
      ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/80"
      : "text-zinc-500 hover:text-zinc-700",
  ].join(" ");
}

type Props = {
  basePath: string;
  searchParams: EvalViewerSearchParams;
  view: EvalViewMode;
};

export function EvalViewToggle({ basePath, searchParams, view }: Props) {
  const galleryHref = buildEvalHref(basePath, searchParams, "gallery");
  const tableHref = buildEvalHref(basePath, searchParams, "table");

  return (
    <div className="flex rounded-lg bg-zinc-100/80 p-0.5">
      <Link
        href={galleryHref}
        className={viewToggleClass(view === "gallery")}
        aria-current={view === "gallery" ? "page" : undefined}
      >
        Gallery
      </Link>
      <Link
        href={tableHref}
        className={viewToggleClass(view === "table")}
        aria-current={view === "table" ? "page" : undefined}
      >
        Table
      </Link>
    </div>
  );
}
