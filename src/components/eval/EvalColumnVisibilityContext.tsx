"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  EVAL_TABLE_COLUMN_STORAGE_KEY,
  EVAL_TABLE_DEFAULT_VISIBLE,
  EVAL_TABLE_MINIMAL_VISIBLE,
  normalizeVisibleColumnSelection,
  orderedVisibleEvalColumns,
  parseStoredVisibleColumns,
  type EvalTableColumnContext,
  type EvalTableColumnId,
} from "@/lib/evalLocal/evalTableColumns";

type EvalColumnVisibilityContextValue = {
  visibleColumnIds: EvalTableColumnId[];
  isColumnVisible: (id: EvalTableColumnId) => boolean;
  toggleColumn: (id: EvalTableColumnId) => void;
  setVisibleColumns: (ids: EvalTableColumnId[]) => void;
  resetColumns: () => void;
  minimalColumns: () => void;
};

const EvalColumnVisibilityContext =
  createContext<EvalColumnVisibilityContextValue | null>(null);

function readInitialVisibleColumns(): EvalTableColumnId[] {
  if (typeof window === "undefined") return [...EVAL_TABLE_DEFAULT_VISIBLE];
  try {
    const stored = parseStoredVisibleColumns(
      localStorage.getItem(EVAL_TABLE_COLUMN_STORAGE_KEY),
    );
    return stored ?? [...EVAL_TABLE_DEFAULT_VISIBLE];
  } catch {
    return [...EVAL_TABLE_DEFAULT_VISIBLE];
  }
}

function persistVisibleColumns(ids: EvalTableColumnId[]) {
  try {
    localStorage.setItem(EVAL_TABLE_COLUMN_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // localStorage unavailable — client-only preference, ignore.
  }
}

export function EvalColumnVisibilityProvider({ children }: { children: ReactNode }) {
  const [visibleColumnIds, setVisibleColumnIdsState] = useState<EvalTableColumnId[]>(
    readInitialVisibleColumns,
  );

  useEffect(() => {
    persistVisibleColumns(visibleColumnIds);
  }, [visibleColumnIds]);

  const setVisibleColumns = useCallback((ids: EvalTableColumnId[]) => {
    setVisibleColumnIdsState(ids);
  }, []);

  const toggleColumn = useCallback((id: EvalTableColumnId) => {
    setVisibleColumnIdsState((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((col) => col !== id);
        return next.length > 0 ? next : prev;
      }
      return [...prev, id];
    });
  }, []);

  const resetColumns = useCallback(() => {
    setVisibleColumnIdsState([...EVAL_TABLE_DEFAULT_VISIBLE]);
  }, []);

  const minimalColumns = useCallback(() => {
    setVisibleColumnIdsState([...EVAL_TABLE_MINIMAL_VISIBLE]);
  }, []);

  const value = useMemo(
    () => ({
      visibleColumnIds,
      isColumnVisible: (id: EvalTableColumnId) => visibleColumnIds.includes(id),
      toggleColumn,
      setVisibleColumns,
      resetColumns,
      minimalColumns,
    }),
    [
      visibleColumnIds,
      toggleColumn,
      setVisibleColumns,
      resetColumns,
      minimalColumns,
    ],
  );

  return (
    <EvalColumnVisibilityContext.Provider value={value}>
      {children}
    </EvalColumnVisibilityContext.Provider>
  );
}

export function useEvalColumnVisibility(): EvalColumnVisibilityContextValue {
  const ctx = useContext(EvalColumnVisibilityContext);
  if (!ctx) {
    throw new Error(
      "useEvalColumnVisibility requires EvalColumnVisibilityProvider",
    );
  }
  return ctx;
}

export function useOrderedVisibleEvalColumns(
  context: EvalTableColumnContext = {},
): EvalTableColumnId[] {
  const { visibleColumnIds } = useEvalColumnVisibility();
  const { inventoryMode = false, omitPartnerFields = false } = context;
  return useMemo(
    () =>
      normalizeVisibleColumnSelection(
        orderedVisibleEvalColumns(visibleColumnIds, {
          inventoryMode,
          omitPartnerFields,
        }),
        { inventoryMode, omitPartnerFields },
      ),
    [visibleColumnIds, inventoryMode, omitPartnerFields],
  );
}
