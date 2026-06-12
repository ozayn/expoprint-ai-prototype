import { computeExtractionCoverage } from "@/lib/evalLocal/extractionCoverage";
import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";

type Props = {
  rows: BrandAuditRow[];
};

function CoverageBar({ percent }: { percent: number }) {
  const width = Math.min(100, Math.max(0, percent));
  return (
    <div className="h-1 w-full rounded-full bg-zinc-100">
      <div
        className="h-full rounded-full bg-zinc-400/80 transition-[width]"
        style={{ width: `${width}%` }}
        role="presentation"
      />
    </div>
  );
}

export function BrandAuditCoverageSummary({ rows }: Props) {
  const coverage = computeExtractionCoverage(rows);

  if (coverage.totalRows === 0) {
    return null;
  }

  return (
    <section className="mb-6 border-b border-zinc-200/60 pb-6">
      <h2 className="text-sm font-medium text-zinc-800">Extraction coverage</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Share of successful websites where each field was found.
      </p>

      <p className="mt-3 text-xs text-zinc-500">
        <span className="tabular-nums">{coverage.totalRows}</span> total
        <span className="mx-1.5 text-zinc-300">·</span>
        <span className="tabular-nums">{coverage.successfulRows}</span> successful
        <span className="mx-1.5 text-zinc-300">·</span>
        <span className="tabular-nums">{coverage.failedRows}</span> failed
      </p>

      {coverage.successfulRows === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          No successful extractions to summarize yet.
        </p>
      ) : (
        <>
          <ul className="mt-4 space-y-3">
            {coverage.fields.map((field) => (
              <li key={field.id}>
                <div className="flex items-baseline justify-between gap-4 text-xs">
                  <span className="text-zinc-500">{field.label}</span>
                  <span className="shrink-0 tabular-nums text-zinc-400">
                    {field.percent}%{" "}
                    <span className="text-zinc-300">
                      {field.count}/{coverage.successfulRows}
                    </span>
                  </span>
                </div>
                <CoverageBar percent={field.percent} />
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-1 text-xs text-zinc-500">
            {coverage.strong.length > 0 ? (
              <p>
                <span className="text-zinc-400">Strong:</span>{" "}
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
        </>
      )}
    </section>
  );
}
