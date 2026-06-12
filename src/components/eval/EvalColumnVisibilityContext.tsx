"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
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

function readStoredVisibleColumns(): EvalTableColumnId[] | null {
  try {
    return parseStoredVisibleColumns(
      localStorage.getItem(EVAL_TABLE_COLUMN_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

function persistVisibleColumns(ids: EvalTableColumnId[]) {
  try {
    localStorage.setItem(EVAL_TABLE_COLUMN_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // localStorage unavailable — client-only preference, ignore.
  }
}

const columnVisibilityListeners = new Set<() => void>();
let columnVisibilityRevision = 0;
let columnVisibilitySnapshot: EvalTableColumnId[] = [...EVAL_TABLE_DEFAULT_VISIBLE];

function subscribeColumnVisibility(onStoreChange: () => void) {
  columnVisibilityListeners.add(onStoreChange);
  return () => {
    columnVisibilityListeners.delete(onStoreChange);
  };
}

function notifyColumnVisibilityChange() {
  for (const listener of columnVisibilityListeners) {
    listener();
  }
}

function getColumnVisibilityServerSnapshot(): EvalTableColumnId[] {
  return columnVisibilitySnapshot;
}

function getColumnVisibilityClientSnapshot(): EvalTableColumnId[] {
  if (columnVisibilityRevision === 0) {
    const stored = readStoredVisibleColumns();
    columnVisibilitySnapshot = stored ?? [...EVAL_TABLE_DEFAULT_VISIBLE];
    columnVisibilityRevision = 1;
  }
  return columnVisibilitySnapshot;
}

function commitColumnVisibility(ids: EvalTableColumnId[]) {
  columnVisibilitySnapshot = ids;
  columnVisibilityRevision += 1;
  persistVisibleColumns(ids);
  notifyColumnVisibilityChange();
}

export function EvalColumnVisibilityProvider({ children }: { children: ReactNode }) {
  const visibleColumnIds = useSyncExternalStore(
    subscribeColumnVisibility,
    getColumnVisibilityClientSnapshot,
    getColumnVisibilityServerSnapshot,
  );

  const setVisibleColumns = useCallback((ids: EvalTableColumnId[]) => {
    commitColumnVisibility(ids);
  }, []);

  const toggleColumn = useCallback((id: EvalTableColumnId) => {
    const prev = getColumnVisibilityClientSnapshot();
    if (prev.includes(id)) {
      const next = prev.filter((col) => col !== id);
      if (next.length > 0) {
        commitColumnVisibility(next);
      }
      return;
    }
    commitColumnVisibility([...prev, id]);
  }, []);

  const resetColumns = useCallback(() => {
    commitColumnVisibility([...EVAL_TABLE_DEFAULT_VISIBLE]);
  }, []);

  const minimalColumns = useCallback(() => {
    commitColumnVisibility([...EVAL_TABLE_MINIMAL_VISIBLE]);
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
