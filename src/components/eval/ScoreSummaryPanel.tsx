import Link from "next/link";
import type { EvalFileEntry } from "@/lib/evalLocal/listEvalFiles";
import type { ParsedScoreSummary } from "@/lib/evalLocal/scoreSummaryTypes";
import type { EvalViewerSearchParams } from "./EvalViewer";

type Props = {
  basePath: string;
  files: EvalFileEntry[];
  activeName?: string;
  data: ParsedScoreSummary | null;
  searchParams: EvalViewerSearchParams;
};

function shortName(name: string): string {
  return name.replace(/^score_summary_/, "").replace(/\.csv$/, "");
}

function filePillClass(active: boolean): string {
  return [
    "rounded-sm px-1.5 py-0.5 font-mono text-xs transition-colors",
    "outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300",
    active
      ? "text-zinc-900 underline decoration-zinc-300 underline-offset-4"
      : "text-zinc-500 hover:text-zinc-700",
  ].join(" ");
}

export function ScoreSummaryPanel({
  basePath,
  files,
  activeName,
  data,
  searchParams,
}: Props) {
  if (files.length === 0) return null;

  const buildHref = (name: string) => {
    const q = new URLSearchParams();
    if (searchParams.summary) q.set("summary", searchParams.summary);
    if (searchParams.review) q.set("review", searchParams.review);
    q.set("score", name);
    return `${basePath}?${q.toString()}`;
  };

  return (
    <section className="mb-12">
      <h2 className="text-sm font-medium text-zinc-900">Score summaries</h2>
      <p className="mt-1 text-xs text-zinc-500">
        From <code className="font-mono text-zinc-600">npm run eval:score</code>{" "}
        after manual scoring.
      </p>

      {files.length > 1 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="text-zinc-400">Summary</span>
          {files.map((f) => {
            const active = f.name === activeName;
            return (
              <Link
                key={f.name}
                href={buildHref(f.name)}
                className={filePillClass(active)}
              >
                {shortName(f.name)}
              </Link>
            );
          })}
        </div>
      ) : null}

      {data ? (
        <dl className="mt-5 grid gap-x-8 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-zinc-400">Rows</dt>
            <dd className="font-medium text-zinc-800">{data.totalRows}</dd>
          </div>
          <div>
            <dt className="text-zinc-400">Overall scored</dt>
            <dd className="font-medium text-zinc-800">
              {data.rowsWithOverallScore}
              <span className="font-normal text-zinc-500">
                {" "}
                · missing {data.rowsMissingOverallScore}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-zinc-400">Extraction</dt>
            <dd className="font-medium text-zinc-800">
              {data.extractionSuccessCount} ok · {data.extractionFailedCount} failed
            </dd>
          </div>
          <div>
            <dt className="text-zinc-400">Reviewer notes</dt>
            <dd className="font-medium text-zinc-800">
              {data.reviewerNotesNonEmptyCount} non-empty
            </dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <dt className="text-zinc-400">Averages</dt>
            <dd className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-zinc-700">
              {Object.entries(data.averages).map(([key, value]) => (
                <span key={key}>
                  {key.replace(/_score$/, "")}: {value || "—"}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">No score summary selected.</p>
      )}

      {data ? (
        <p className="mt-4 text-[11px] text-zinc-400">
          Source:{" "}
          <span className="font-mono text-zinc-500">{data.filename}</span>
          {data.inputFile ? (
            <>
              {" "}
              · input{" "}
              <span className="font-mono text-zinc-500">
                {data.inputFile.split("/").pop()}
              </span>
            </>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
