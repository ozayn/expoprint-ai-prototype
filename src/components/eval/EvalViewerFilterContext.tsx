"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { FieldFilterId } from "@/lib/evalLocal/fieldCoverageHelpers";
import type { EvalStatusFilter } from "@/lib/evalLocal/evalRowFilters";
import {
  buildEvalViewerHref,
  patchEvalViewerQuery,
  type EvalViewerQueryParams,
} from "@/lib/evalLocal/evalViewerQuery";

type EvalViewerFilterUrlSync = {
  basePath: string;
  searchParams: EvalViewerQueryParams;
};

type EvalViewerFilterProviderProps = {
  children: ReactNode;
  initialStatusFilter?: EvalStatusFilter;
  urlSync?: EvalViewerFilterUrlSync;
};

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

export function EvalViewerFilterProvider({
  children,
  initialStatusFilter = "all",
  urlSync,
}: EvalViewerFilterProviderProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<EvalStatusFilter>(initialStatusFilter);
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

      if (!urlSync) return;

      const legacyInventory = urlSync.searchParams.inventory?.trim().toLowerCase();
      const clearLegacyInventory =
        legacyInventory === "not_run" || legacyInventory === "failed";

      const next = patchEvalViewerQuery(urlSync.searchParams, {
        status: value === "all" ? "" : value,
        inventory: clearLegacyInventory ? "" : urlSync.searchParams.inventory,
      });
      router.replace(buildEvalViewerHref(urlSync.basePath, next), {
        scroll: false,
      });
    },
    [resetPagination, router, urlSync],
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

export type { EvalStatusFilter };
