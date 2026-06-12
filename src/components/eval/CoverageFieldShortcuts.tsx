"use client";

import type { ExtractionCoverageField } from "@/lib/evalLocal/extractionCoverage";
import { missingFieldFilterForCoverageField } from "@/lib/evalLocal/fieldCoverageHelpers";
import { useOptionalEvalViewerFilters } from "./EvalViewerFilterContext";

type Props = {
  fields: ExtractionCoverageField[];
  successfulRows: number;
};

export function CoverageFieldShortcuts({ fields, successfulRows }: Props) {
  const filters = useOptionalEvalViewerFilters();
  if (!filters || successfulRows === 0) return null;

  const { fieldFilters, addFieldFilter, setStatusFilter } = filters;

  function applyMissingFilter(fieldId: ExtractionCoverageField["id"]) {
    const filterId = missingFieldFilterForCoverageField(fieldId);
    if (!fieldFilters.includes(filterId)) {
      addFieldFilter(filterId);
    }
    setStatusFilter("success");
  }

  const gapFields = fields.filter((f) => f.count < successfulRows);
  if (gapFields.length === 0) return null;

  return (
    <p className="mt-3 text-xs text-zinc-500">
      <span className="text-zinc-400">Filter gaps:</span>{" "}
      {gapFields.map((field, index) => {
        const filterId = missingFieldFilterForCoverageField(field.id);
        const isActive = fieldFilters.includes(filterId);
        return (
          <span key={field.id}>
            {index > 0 ? " · " : null}
            <button
              type="button"
              onClick={() => applyMissingFilter(field.id)}
              className={`underline-offset-2 hover:underline ${
                isActive ? "text-zinc-800" : "text-zinc-500"
              }`}
            >
              {field.label} {field.count}/{successfulRows}
            </button>
          </span>
        );
      })}
    </p>
  );
}
