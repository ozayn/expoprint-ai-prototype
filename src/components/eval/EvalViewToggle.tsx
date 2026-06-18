"use client";

import Link from "next/link";
import {
  buildEvalViewerHref,
  patchEvalViewerQuery,
} from "@/lib/evalLocal/evalViewerQuery";
import type { EvalViewerSearchParams } from "./BrandAuditViewer";

export type EvalViewMode = "gallery" | "table" | "inventory";

function buildViewHref(
  basePath: string,
  current: EvalViewerSearchParams,
  view: EvalViewMode,
): string {
  const viewParam =
    view === "gallery" ? undefined : view === "table" ? "table" : "inventory";
  const patch: Partial<EvalViewerSearchParams> = { view: viewParam };
  if (view === "inventory" && !current.sort?.trim()) {
    patch.sort = "recent";
  }
  return buildEvalViewerHref(basePath, patchEvalViewerQuery(current, patch));
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
  showInventoryTab?: boolean;
};

export function EvalViewToggle({
  basePath,
  searchParams,
  view,
  showInventoryTab = false,
}: Props) {
  const galleryHref = buildViewHref(basePath, searchParams, "gallery");
  const tableHref = buildViewHref(basePath, searchParams, "table");
  const inventoryHref = buildViewHref(basePath, searchParams, "inventory");

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
        Extracted table
      </Link>
      {showInventoryTab ? (
        <Link
          href={inventoryHref}
          className={viewToggleClass(view === "inventory")}
          aria-current={view === "inventory" ? "page" : undefined}
        >
          All URLs
        </Link>
      ) : null}
    </div>
  );
}
