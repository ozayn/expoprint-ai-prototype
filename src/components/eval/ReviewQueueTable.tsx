"use client";

import { useState } from "react";
import {
  ColorSwatchRow,
  LogoCandidateDetailList,
  LogoThumbnailRow,
} from "./BrandExtractionCells";
import { EvalSourceLink, EvalUrlDetailField } from "./EvalExternalLink";
import {
  type ReviewQueueAuditColumn,
  type ReviewQueueRow,
} from "@/lib/evalLocal/reviewQueueTypes";

type TableColumn =
  | { kind: "text"; col: ReviewQueueAuditColumn }
  | { kind: "logos" }
  | { kind: "colors" };

const TABLE_COLUMNS: TableColumn[] = [
  { kind: "text", col: "domain" },
  { kind: "text", col: "extracted_business_name" },
  { kind: "text", col: "extracted_business_category" },
  { kind: "logos" },
  { kind: "colors" },
  { kind: "text", col: "extracted_summary" },
  { kind: "text", col: "status" },
  { kind: "text", col: "pages_inspected" },
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

function truncateCell(value: string, max = 48): string {
  const v = value.trim();
  if (!v) return "—";
  if (v.length <= max) return v;
  return `${v.slice(0, max - 1)}…`;
}

function columnLabel(col: ReviewQueueAuditColumn): string {
  if (col === "domain") return "source";
  return col.replace(/_/g, " ");
}

function TextCell({
  col,
  row,
}: {
  col: ReviewQueueAuditColumn;
  row: ReviewQueueRow;
}) {
  if (col === "domain") {
    return (
      <EvalSourceLink
        row={row}
        className="text-[12px] text-zinc-700"
        mono
        stopPropagation
      />
    );
  }

  if (col === "status") {
    return <StatusPill status={row.status ?? ""} />;
  }

  const v = (row[col] ?? "").trim();
  return (
    <span className="text-zinc-800" title={v || undefined}>
      {truncateCell(v)}
    </span>
  );
}

type Props = {
  filename: string;
  rows: ReviewQueueRow[];
};

export function ReviewQueueTable({ filename, rows }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const colSpan = TABLE_COLUMNS.length + 1; /* expand */

  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500">No review rows to display.</p>
    );
  }

  return (
    <div>
      <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1">
        <table className="w-full min-w-[880px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-zinc-200 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              <th className="w-7 pb-2 pr-1 font-normal" aria-label="Expand" />
              {TABLE_COLUMNS.map((column, index) => (
                <th key={index} className="pb-2 pr-3 font-normal">
                  {column.kind === "text"
                    ? columnLabel(column.col)
                    : column.kind}
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
                  colSpan={colSpan}
                  onToggle={() => setExpandedIndex(expanded ? null : i)}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {filename ? (
        <p className="mt-4 text-[11px] text-zinc-400">
          Source: <span className="font-mono text-zinc-500">{filename}</span>
        </p>
      ) : null}
    </div>
  );
}

function RowGroup({
  row,
  expanded,
  colSpan,
  onToggle,
}: {
  row: ReviewQueueRow;
  expanded: boolean;
  colSpan: number;
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
        <td className="py-2 pr-1 text-[10px] text-zinc-300">
          {expanded ? "▾" : "▸"}
        </td>
        {TABLE_COLUMNS.map((column, index) => {
          if (column.kind === "logos") {
            return (
              <td key={index} className="max-w-[7rem] py-2 pr-3 align-middle">
                <LogoThumbnailRow
                  row={row}
                  max={3}
                  showExtraCount
                  size="sm"
                  emptyLabel="No logo"
                />
              </td>
            );
          }
          if (column.kind === "colors") {
            return (
              <td key={index} className="max-w-[14rem] py-2 pr-3 align-middle">
                <ColorSwatchRow
                  row={row}
                  max={5}
                  compact
                  emptyLabel="No palette"
                />
              </td>
            );
          }
          return (
            <td
              key={index}
              className="max-w-[12rem] py-2 pr-3 whitespace-normal break-words align-middle"
            >
              <TextCell col={column.col} row={row} />
            </td>
          );
        })}
      </tr>
      {expanded ? (
        <tr className="border-b border-zinc-100 bg-zinc-50/40">
          <td colSpan={colSpan} className="px-1 py-5">
            <ExpandedRowDetails row={row} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ExpandedRowDetails({ row }: { row: ReviewQueueRow }) {
  const hasScores =
    row.business_name_score.trim() ||
    row.category_score.trim() ||
    row.logo_score.trim() ||
    row.brief_score.trim() ||
    row.overall_score.trim() ||
    row.reviewer_notes.trim();

  const providerModel = [row.extraction_provider, row.extraction_model]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            Historical context
          </h4>
          <dl className="mt-2 space-y-2 text-sm text-zinc-800">
            <DetailField label="ds number" value={row.ds_number} />
            <DetailField label="project title" value={row.project_title} />
            <DetailField label="project type" value={row.project_type} />
            <DetailField label="shop code" value={row.shop_code} />
            <EvalUrlDetailField label="normalized url" value={row.normalized_url} row={row} />
          </dl>
        </div>

        <div>
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            Technical
          </h4>
          <dl className="mt-2 space-y-2 text-sm text-zinc-800">
            <DetailField label="provider / model" value={providerModel} />
            <DetailField label="elapsed ms" value={row.elapsed_ms} />
            <DetailField label="error" value={row.error_message} />
          </dl>
        </div>

        <div>
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            Brand assets
          </h4>
          <div className="mt-3 space-y-4">
            {row.selected_logo_url.trim() ? (
              <p className="text-xs text-zinc-500">
                Best logo:{" "}
                <span className="font-mono text-zinc-600">{row.selected_logo_url}</span>
              </p>
            ) : null}
            <LogoCandidateDetailList row={row} />
            <div>
              <p className="mb-2 text-[11px] text-zinc-400">Colors</p>
              <ColorSwatchRow row={row} />
            </div>
            <DetailField
              label="extracted color hexes"
              value={row.extracted_color_hexes}
              mono
            />
          </div>
        </div>

        {row.extracted_tagline.trim() ? (
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Identity
            </h4>
            <dl className="mt-2 space-y-2 text-sm text-zinc-800">
              <DetailField label="tagline" value={row.extracted_tagline} />
            </dl>
          </div>
        ) : null}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-600">
          Manual scores
        </summary>
        {hasScores ? (
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField label="business name score" value={row.business_name_score} />
            <DetailField label="category score" value={row.category_score} />
            <DetailField label="logo score" value={row.logo_score} />
            <DetailField label="brief score" value={row.brief_score} />
            <DetailField label="overall score" value={row.overall_score} />
            <DetailField label="reviewer notes" value={row.reviewer_notes} />
          </dl>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">
            No manual scores yet — fill columns in the review_queue CSV.
          </p>
        )}
      </details>
    </div>
  );
}

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const v = value.trim();
  if (!v) return null;
  return (
    <div>
      <dt className="text-[11px] text-zinc-400">{label}</dt>
      <dd className={`mt-0.5 break-all ${mono ? "font-mono text-xs" : ""}`}>{v}</dd>
    </div>
  );
}
