"use client";

import { useState } from "react";
import {
  ColorSwatchRow,
  LogoCandidateDetailList,
  LogoThumbnailRow,
} from "./BrandExtractionCells";
import {
  AddressCell,
  EmailListCell,
  PhoneListCell,
  SocialLinksCell,
} from "./ContactTableCells";
import { EvalSourceLink, EvalUrlDetailField } from "./EvalExternalLink";
import {
  contactLinksForRow,
  emailsForRow,
  phonesForRow,
  socialLinksForRow,
  addressesForRow,
} from "@/lib/evalLocal/contactExtractionParse";
import {
  type ReviewQueueAuditColumn,
  type ReviewQueueRow,
} from "@/lib/evalLocal/reviewQueueTypes";

type TableColumn =
  | { kind: "text"; col: ReviewQueueAuditColumn }
  | { kind: "logos" }
  | { kind: "colors" }
  | { kind: "emails" }
  | { kind: "phones" }
  | { kind: "social" }
  | { kind: "address" };

const TABLE_COLUMNS: TableColumn[] = [
  { kind: "text", col: "domain" },
  { kind: "text", col: "extracted_business_name" },
  { kind: "logos" },
  { kind: "colors" },
  { kind: "emails" },
  { kind: "phones" },
  { kind: "social" },
  { kind: "address" },
  { kind: "text", col: "status" },
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

function columnLabel(column: TableColumn): string {
  if (column.kind !== "text") return column.kind;
  if (column.col === "domain") return "source";
  return column.col.replace(/_/g, " ");
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
      {v || "—"}
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
        <table className="w-full min-w-[1080px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-zinc-200 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              <th className="w-7 pb-2 pr-1 font-normal" aria-label="Expand" />
              {TABLE_COLUMNS.map((column, index) => (
                <th key={index} className="pb-2 pr-3 font-normal">
                  {columnLabel(column)}
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
          if (column.kind === "emails") {
            return (
              <td key={index} className="max-w-[10rem] py-2 pr-3 align-middle">
                <EmailListCell row={row} />
              </td>
            );
          }
          if (column.kind === "phones") {
            return (
              <td key={index} className="max-w-[9rem] py-2 pr-3 align-middle">
                <PhoneListCell row={row} />
              </td>
            );
          }
          if (column.kind === "social") {
            return (
              <td key={index} className="max-w-[9rem] py-2 pr-3 align-middle">
                <SocialLinksCell row={row} />
              </td>
            );
          }
          if (column.kind === "address") {
            return (
              <td key={index} className="max-w-[11rem] py-2 pr-3 align-middle">
                <AddressCell row={row} />
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

  const emails = emailsForRow(row);
  const phones = phonesForRow(row);
  const social = socialLinksForRow(row);
  const addresses = addressesForRow(row);
  const contactLinks = contactLinksForRow(row);
  const hasContactSection =
    emails.length > 0 ||
    phones.length > 0 ||
    social.length > 0 ||
    addresses.length > 0 ||
    contactLinks.length > 0;

  const hasIdentity =
    row.extracted_business_category.trim() ||
    row.extracted_summary.trim() ||
    row.extracted_tagline.trim();

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
            <DetailField label="pages inspected" value={row.pages_inspected} />
            <DetailField label="provider / model" value={providerModel} />
            <DetailField label="elapsed ms" value={row.elapsed_ms} />
            <DetailField label="error" value={row.error_message} />
          </dl>
        </div>

        {hasIdentity ? (
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Identity
            </h4>
            <dl className="mt-2 space-y-2 text-sm text-zinc-800">
              <DetailField label="category" value={row.extracted_business_category} />
              <DetailField label="summary" value={row.extracted_summary} />
              <DetailField label="tagline" value={row.extracted_tagline} />
            </dl>
          </div>
        ) : null}

        {hasContactSection ? (
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Contact & web
            </h4>
            <dl className="mt-2 space-y-2 text-sm text-zinc-800">
              {emails.length > 0 ? (
                <div>
                  <dt className="text-[11px] text-zinc-400">emails</dt>
                  <dd className="mt-1 space-y-1">
                    {emails.map((email) => (
                      <a
                        key={email}
                        href={`mailto:${email}`}
                        className="block font-mono text-xs text-zinc-700 hover:underline"
                      >
                        {email}
                      </a>
                    ))}
                  </dd>
                </div>
              ) : null}
              {phones.length > 0 ? (
                <div>
                  <dt className="text-[11px] text-zinc-400">phone numbers</dt>
                  <dd className="mt-1 space-y-1">
                    {phones.map((phone) => (
                      <span key={phone} className="block text-sm">{phone}</span>
                    ))}
                  </dd>
                </div>
              ) : null}
              {social.length > 0 ? (
                <div>
                  <dt className="text-[11px] text-zinc-400">social links</dt>
                  <dd className="mt-1 space-y-1">
                    {social.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="block text-sm text-zinc-700 hover:underline"
                      >
                        {link.label}: {link.url}
                      </a>
                    ))}
                  </dd>
                </div>
              ) : null}
              {addresses.length > 0 ? (
                <div>
                  <dt className="text-[11px] text-zinc-400">addresses</dt>
                  <dd className="mt-1 space-y-1">
                    {addresses.map((addr) => (
                      <span key={addr} className="block text-sm">{addr}</span>
                    ))}
                  </dd>
                </div>
              ) : null}
              {contactLinks.length > 0 ? (
                <div>
                  <dt className="text-[11px] text-zinc-400">contact links</dt>
                  <dd className="mt-1 space-y-1">
                    {contactLinks.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="block break-all text-xs text-zinc-700 hover:underline"
                      >
                        {link.label ? `${link.label}: ` : ""}{link.url}
                      </a>
                    ))}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}

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
