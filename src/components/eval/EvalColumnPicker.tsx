"use client";

import { useEffect, useRef, useState } from "react";
import {
  allEvalTableColumnsForContext,
  EVAL_TABLE_COLUMN_LABELS,
  pickableEvalTableColumns,
  type EvalTableColumnContext,
} from "@/lib/evalLocal/evalTableColumns";
import { useEvalColumnVisibility } from "./EvalColumnVisibilityContext";

type Props = EvalTableColumnContext;

export function EvalColumnPicker({
  inventoryMode = false,
  omitPartnerFields = false,
}: Props) {
  const {
    visibleColumnIds,
    toggleColumn,
    resetColumns,
    setVisibleColumns,
    minimalColumns,
  } = useEvalColumnVisibility();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const pickable = pickableEvalTableColumns({
    inventoryMode,
    omitPartnerFields,
  });

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        Columns
      </button>

      {open ? (
        <div
          className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-zinc-200 bg-white py-2 shadow-sm"
          role="listbox"
          aria-label="Table columns"
        >
          <ul className="max-h-64 overflow-y-auto px-2">
            {pickable.map((id) => {
              const checked = visibleColumnIds.includes(id);
              return (
                <li key={id}>
                  <label
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleColumn(id)}
                      className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-600 focus:ring-zinc-200"
                    />
                    <span>{EVAL_TABLE_COLUMN_LABELS[id]}</span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-zinc-100 px-3 pt-2">
            <button
              type="button"
              onClick={() => {
                resetColumns();
                setOpen(false);
              }}
              className="text-[11px] text-zinc-500 hover:text-zinc-700"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => {
                setVisibleColumns(
                  allEvalTableColumnsForContext({
                    inventoryMode,
                    omitPartnerFields,
                  }),
                );
              }}
              className="text-[11px] text-zinc-500 hover:text-zinc-700"
            >
              Show all
            </button>
            <button
              type="button"
              onClick={() => {
                minimalColumns();
              }}
              className="text-[11px] text-zinc-500 hover:text-zinc-700"
            >
              Minimal
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
