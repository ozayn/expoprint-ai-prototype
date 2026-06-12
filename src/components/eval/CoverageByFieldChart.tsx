import { CoverageFieldShortcuts } from "./CoverageFieldShortcuts";
import { EvalHorizontalBars, barWidthsFromCounts } from "./EvalHorizontalBars";
import {
  computeExtractionCoverage,
  type ExtractionCoverageFieldId,
} from "@/lib/evalLocal/extractionCoverage";
import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";

const CHART_FIELD_LABELS: Record<ExtractionCoverageFieldId, string> = {
  business_name: "Business name",
  logos: "Logo",
  colors: "Colors",
  emails: "Email",
  phones: "Phone",
  social: "Social links",
  address: "Address",
  products_services: "Products/services",
  summary: "Summary",
};

type Props = {
  rows: BrandAuditRow[];
};

export function CoverageByFieldChart({ rows }: Props) {
  const coverage = computeExtractionCoverage(rows);

  if (coverage.totalRows === 0) {
    return null;
  }

  const barWidths = barWidthsFromCounts(coverage.fields.map((f) => f.count));

  const items = coverage.fields.map((field, index) => ({
    key: field.id,
    label: CHART_FIELD_LABELS[field.id],
    count: field.count,
    barPercent: barWidths[index] ?? 0,
    detail:
      coverage.successfulRows > 0
        ? `${field.count}/${coverage.successfulRows} · ${field.percent}%`
        : undefined,
  }));

  return (
    <div>
      <h3 className="text-sm font-medium text-zinc-800">Coverage by field</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Successful extractions only ({coverage.successfulRows} of{" "}
        {coverage.totalRows} rows).
      </p>

      {coverage.successfulRows === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          No successful extractions to chart yet.
        </p>
      ) : (
        <>
          <div className="mt-4">
            <EvalHorizontalBars items={items} />
          </div>

          <div className="mt-4 space-y-1 text-xs text-zinc-500">
            {coverage.strong.length > 0 ? (
              <p>
                <span className="text-zinc-400">Strongest:</span>{" "}
                {coverage.strong.join(", ")}
              </p>
            ) : null}
            {coverage.needsWork.length > 0 ? (
              <p>
                <span className="text-zinc-400">Needs work:</span>{" "}
                {coverage.needsWork.join(", ")}
              </p>
            ) : null}
          </div>

          <CoverageFieldShortcuts
            fields={coverage.fields}
            successfulRows={coverage.successfulRows}
          />
        </>
      )}
    </div>
  );
}
