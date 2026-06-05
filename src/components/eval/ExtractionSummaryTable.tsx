"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  EXTRACTION_SUMMARY_VISIBLE_COLUMNS,
  type ExtractionSummaryRow,
} from "@/lib/evalLocal/extractionSummaryTypes";

const DETAIL_GROUPS: {
  title: string;
  fields: { key: keyof ExtractionSummaryRow | "pages_inspected"; label: string }[];
}[] = [
  {
    title: "Historical",
    fields: [
      { key: "project_type", label: "project_type" },
      { key: "shop_code", label: "shop_code" },
    ],
  },
  {
    title: "Input",
    fields: [
      { key: "domain", label: "domain" },
      { key: "canonical_domain", label: "canonical_domain" },
    ],
  },
  {
    title: "ExpoPrint",
    fields: [
      { key: "extracted_business_name", label: "extracted_business_name" },
      { key: "logo_candidate_count", label: "logo_candidate_count" },
      { key: "pages_inspected", label: "pages_inspected" },
      { key: "error_message", label: "error_message" },
    ],
  },
];

function isErrorStatus(status: string): boolean {
  return (
    status === "fetch_error" ||
    status === "extraction_error" ||
    status === "skipped"
  );
}

function StatusPill({ status }: { status: string }) {
  const v = status.trim() || "—";
  if (v === "—") return <span className="text-zinc-400">—</span>;

  const success = v === "success";
  const error = isErrorStatus(v);

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
        success
          ? "bg-emerald-50 text-emerald-700"
          : error
            ? "bg-red-50 text-red-700"
            : "bg-zinc-100 text-zinc-600"
      }`}
    >
      {v}
    </span>
  );
}

function truncateUrl(value: string, max = 42): { display: string; title?: string } {
  const v = value.trim();
  if (!v) return { display: "—" };
  if (v.length <= max) return { display: v };
  return { display: `${v.slice(0, max)}…`, title: v };
}

function formatCell(
  col: (typeof EXTRACTION_SUMMARY_VISIBLE_COLUMNS)[number],
  value: string,
): { display: ReactNode; title?: string } {
  const v = value.trim();
  if (!v) return { display: "—" };

  if (col === "status") {
    return { display: <StatusPill status={v} /> };
  }

  if (col === "normalized_url") {
    const { display, title } = truncateUrl(v, 40);
    return { display, title };
  }

  if (col === "project_title") {
    const { display, title } = truncateUrl(v, 32);
    return { display, title };
  }

  if (col === "elapsed_ms") {
    return { display: `${v} ms` };
  }

  return { display: v, title: v.length > 24 ? v : undefined };
}

export function computeSummaryStats(rows: ExtractionSummaryRow[]) {
  let success = 0;
  let error = 0;
  const canonicalDomains = new Set<string>();

  for (const row of rows) {
    const status = row.status.trim();
    if (status === "success") success += 1;
    else if (status) error += 1;
    const canon = row.canonical_domain.trim();
    if (canon) canonicalDomains.add(canon);
  }

  return {
    rows: rows.length,
    success,
    error,
    canonicalDomains: canonicalDomains.size,
  };
}

type Props = {
  filename: string;
  rows: ExtractionSummaryRow[];
};

export function ExtractionSummaryTable({ filename, rows }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const stats = useMemo(() => computeSummaryStats(rows), [rows]);

  return (
    <div>
      <dl className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-zinc-500">
        <div>
          <dt className="inline text-zinc-400">Rows </dt>
          <dd className="inline font-medium text-zinc-800">{stats.rows}</dd>
        </div>
        <div>
          <dt className="inline text-zinc-400">Success </dt>
          <dd className="inline font-medium text-zinc-800">{stats.success}</dd>
        </div>
        <div>
          <dt className="inline text-zinc-400">Errors </dt>
          <dd className="inline font-medium text-zinc-800">{stats.error}</dd>
        </div>
        <div>
          <dt className="inline text-zinc-400">Canonical domains </dt>
          <dd className="inline font-medium text-zinc-800">{stats.canonicalDomains}</dd>
        </div>
      </dl>

      <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1">
        <table className="w-full min-w-[480px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-zinc-200 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              <th className="w-7 pb-2 pr-1 font-normal" aria-label="Expand" />
              {EXTRACTION_SUMMARY_VISIBLE_COLUMNS.map((col) => (
                <th key={col} className="pb-2 pr-3 font-normal last:pr-0">
                  {col.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const expanded = expandedIndex === i;
              return (
                <RowGroup
                  key={i}
                  row={row}
                  expanded={expanded}
                  onToggle={() => setExpandedIndex(expanded ? null : i)}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[11px] text-zinc-400">
        Source: <span className="font-mono text-zinc-500">{filename}</span>
      </p>
    </div>
  );
}

function RowGroup({
  row,
  expanded,
  onToggle,
}: {
  row: ExtractionSummaryRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className={`cursor-pointer border-b border-zinc-100 align-top transition-colors hover:bg-zinc-50/80 ${
          expanded ? "bg-zinc-50/60" : ""
        }`}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <td className="py-2.5 pr-1 text-[10px] text-zinc-300">
          {expanded ? "▾" : "▸"}
        </td>
        {EXTRACTION_SUMMARY_VISIBLE_COLUMNS.map((col) => {
          const raw = row[col] ?? "";
          const { display, title } = formatCell(col, raw);
          const isTitle = col === "project_title";
          return (
            <td
              key={col}
              className={`py-2.5 pr-3 text-zinc-800 last:pr-0 ${
                isTitle ? "max-w-[14rem] whitespace-normal break-words" : "whitespace-nowrap"
              }`}
              title={title}
            >
              {display}
            </td>
          );
        })}
      </tr>
      {expanded ? (
        <tr className="border-b border-zinc-100 bg-zinc-50/40">
          <td colSpan={EXTRACTION_SUMMARY_VISIBLE_COLUMNS.length + 1} className="px-1 py-4">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {DETAIL_GROUPS.map((group) => (
                <div key={group.title}>
                  <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    {group.title}
                  </h4>
                  <dl className="mt-2 space-y-2.5">
                    {group.fields.map(({ key, label }) => {
                      const value = (row[key] ?? "").trim();
                      if (!value) return null;
                      return (
                        <div key={label} className="min-w-0">
                          <dt className="text-[11px] text-zinc-400">{label}</dt>
                          <dd className="mt-0.5 break-all text-sm text-zinc-800">{value}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              ))}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
