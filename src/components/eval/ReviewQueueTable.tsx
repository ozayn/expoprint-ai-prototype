"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  REVIEW_QUEUE_VISIBLE_COLUMNS,
  type ReviewQueueRow,
} from "@/lib/evalLocal/reviewQueueTypes";

const DETAIL_GROUPS: {
  title: string;
  fields: (keyof ReviewQueueRow)[];
}[] = [
  {
    title: "Historical",
    fields: [
      "project_title",
      "project_type",
      "shop_code",
      "first_req_description_excerpt",
      "first_req_note_excerpt",
    ],
  },
  {
    title: "Input",
    fields: ["normalized_url", "domain", "canonical_domain"],
  },
  {
    title: "ExpoPrint",
    fields: [
      "extracted_business_name",
      "extracted_business_category",
      "extracted_summary",
      "logo_candidate_count",
      "pages_inspected",
      "error_message",
    ],
  },
  {
    title: "Review",
    fields: [
      "business_name_score",
      "category_score",
      "logo_score",
      "brief_score",
      "overall_score",
      "reviewer_notes",
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

function truncate(value: string, max: number): { display: string; title?: string } {
  const v = value.trim();
  if (!v) return { display: "—" };
  if (v.length <= max) return { display: v, title: v };
  return { display: `${v.slice(0, max)}…`, title: v };
}

function formatCell(
  col: (typeof REVIEW_QUEUE_VISIBLE_COLUMNS)[number],
  value: string,
): { display: ReactNode; title?: string } {
  const v = value.trim();
  if (!v) return { display: "—" };

  if (col === "status") return { display: <StatusPill status={v} /> };
  if (col === "project_title") return truncate(v, 28);
  if (col === "extracted_business_name") return { display: v, title: v };
  if (col === "extracted_business_category") return truncate(v, 20);
  if (col === "reviewer_notes") return truncate(v, 32);
  if (col === "overall_score") {
    return {
      display: v || "—",
      title: v ? `Score: ${v}` : undefined,
    };
  }

  return { display: v, title: v.length > 20 ? v : undefined };
}

type Props = {
  filename: string;
  rows: ReviewQueueRow[];
};

export function ReviewQueueTable({ filename, rows }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const stats = useMemo(() => {
    let scored = 0;
    let unscored = 0;
    for (const row of rows) {
      if (row.overall_score.trim()) scored += 1;
      else unscored += 1;
    }
    return { rows: rows.length, scored, unscored };
  }, [rows]);

  return (
    <div>
      <dl className="mb-6 flex flex-wrap gap-x-8 gap-y-2 text-xs text-zinc-500">
        <div>
          <dt className="inline text-zinc-400">Rows </dt>
          <dd className="inline font-medium text-zinc-800">{stats.rows}</dd>
        </div>
        <div>
          <dt className="inline text-zinc-400">Scored </dt>
          <dd className="inline font-medium text-zinc-800">{stats.scored}</dd>
        </div>
        <div>
          <dt className="inline text-zinc-400">Unscored </dt>
          <dd className="inline font-medium text-zinc-800">{stats.unscored}</dd>
        </div>
      </dl>

      <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1">
        <table className="w-full min-w-[560px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-zinc-200 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              <th className="w-7 pb-2 pr-1 font-normal" aria-label="Expand" />
              {REVIEW_QUEUE_VISIBLE_COLUMNS.map((col) => (
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
  row: ReviewQueueRow;
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
        {REVIEW_QUEUE_VISIBLE_COLUMNS.map((col) => {
          const raw = row[col] ?? "";
          const { display, title } = formatCell(col, raw);
          const isBusinessName = col === "extracted_business_name";
          return (
            <td
              key={col}
              className={`py-2.5 pr-3 text-zinc-800 last:pr-0 ${
                isBusinessName
                  ? "max-w-[12rem] whitespace-normal break-words"
                  : "whitespace-nowrap"
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
          <td colSpan={REVIEW_QUEUE_VISIBLE_COLUMNS.length + 1} className="px-1 py-4">
            <div className="grid gap-6 sm:grid-cols-2">
              {DETAIL_GROUPS.map((group) => (
                <div key={group.title}>
                  <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    {group.title}
                  </h4>
                  <dl className="mt-2 space-y-2.5">
                    {group.fields.map((key) => {
                      const value = (row[key] ?? "").trim();
                      if (!value) return null;
                      return (
                        <div key={key} className="min-w-0">
                          <dt className="text-[11px] text-zinc-400">
                            {key.replace(/_/g, " ")}
                          </dt>
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
