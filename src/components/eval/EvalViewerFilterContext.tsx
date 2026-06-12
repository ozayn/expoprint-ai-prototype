"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FieldFilterId } from "@/lib/evalLocal/fieldCoverageHelpers";
import type { UrlInventoryExtractionStatus } from "@/lib/evalLocal/urlInventoryJoin";

export type EvalStatusFilter = "all" | UrlInventoryExtractionStatus;

type EvalViewerFilterContextValue = {
  search: string;
  setSearch: (value: string) => void;
  statusFilter: EvalStatusFilter;
  setStatusFilter: (value: EvalStatusFilter) => void;
  fieldFilters: FieldFilterId[];
  addFieldFilter: (id: FieldFilterId) => void;
  removeFieldFilter: (id: FieldFilterId) => void;
  clearFieldFilters: () => void;
  resetPagination: () => void;
  paginationKey: number;
};

const EvalViewerFilterContext = createContext<EvalViewerFilterContextValue | null>(
  null,
);

export function EvalViewerFilterProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EvalStatusFilter>("all");
  const [fieldFilters, setFieldFilters] = useState<FieldFilterId[]>([]);
  const [paginationKey, setPaginationKey] = useState(0);

  const resetPagination = useCallback(() => {
    setPaginationKey((k) => k + 1);
  }, []);

  const addFieldFilter = useCallback(
    (id: FieldFilterId) => {
      setFieldFilters((prev) => (prev.includes(id) ? prev : [...prev, id]));
      resetPagination();
    },
    [resetPagination],
  );

  const removeFieldFilter = useCallback(
    (id: FieldFilterId) => {
      setFieldFilters((prev) => prev.filter((f) => f !== id));
      resetPagination();
    },
    [resetPagination],
  );

  const clearFieldFilters = useCallback(() => {
    setFieldFilters([]);
    resetPagination();
  }, [resetPagination]);

  const setSearchWrapped = useCallback(
    (value: string) => {
      setSearch(value);
      resetPagination();
    },
    [resetPagination],
  );

  const setStatusFilterWrapped = useCallback(
    (value: EvalStatusFilter) => {
      setStatusFilter(value);
      resetPagination();
    },
    [resetPagination],
  );

  const value = useMemo(
    () => ({
      search,
      setSearch: setSearchWrapped,
      statusFilter,
      setStatusFilter: setStatusFilterWrapped,
      fieldFilters,
      addFieldFilter,
      removeFieldFilter,
      clearFieldFilters,
      resetPagination,
      paginationKey,
    }),
    [
      search,
      setSearchWrapped,
      statusFilter,
      setStatusFilterWrapped,
      fieldFilters,
      addFieldFilter,
      removeFieldFilter,
      clearFieldFilters,
      resetPagination,
      paginationKey,
    ],
  );

  return (
    <EvalViewerFilterContext.Provider value={value}>
      {children}
    </EvalViewerFilterContext.Provider>
  );
}

export function useEvalViewerFilters(): EvalViewerFilterContextValue {
  const ctx = useContext(EvalViewerFilterContext);
  if (!ctx) {
    throw new Error("useEvalViewerFilters requires EvalViewerFilterProvider");
  }
  return ctx;
}

export function useOptionalEvalViewerFilters(): EvalViewerFilterContextValue | null {
  return useContext(EvalViewerFilterContext);
}
