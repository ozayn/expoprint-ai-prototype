"use client";

import {
  ColorSwatchRow,
  LogoThumbnailRow,
} from "./BrandExtractionCells";
import {
  AddressCell,
  ContactLinksCell,
  EmailListCell,
  OfferingsListCell,
  PhoneListCell,
  SocialLinksCell,
} from "./ContactTableCells";
import { EvalExternalLink, EvalSourceLink } from "./EvalExternalLink";
import { safeHttpHref } from "@/lib/evalLocal/evalRowUrl";
import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";
import type { EvalTableColumnId } from "@/lib/evalLocal/evalTableColumns";

function isErrorStatus(status: string): boolean {
  return (
    status === "fetch_error" ||
    status === "extraction_error" ||
    status === "skipped"
  );
}

export function ReviewStatusPill({ status }: { status: string }) {
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

function TextFieldCell({
  value,
  truncate,
}: {
  value: string;
  truncate?: number;
}) {
  const v = value.trim();
  const display =
    truncate && v.length > truncate ? `${v.slice(0, truncate - 1)}…` : v;
  return (
    <span className="text-zinc-800" title={v || undefined}>
      {display || "—"}
    </span>
  );
}

function ProviderModelCell({ row }: { row: BrandAuditRow }) {
  const value = [row.extraction_provider, row.extraction_model]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(" · ");
  return <TextFieldCell value={value} />;
}

export function evalReviewTableCellClass(columnId: EvalTableColumnId): string {
  const wide: EvalTableColumnId[] = [
    "normalized_url",
    "project_title",
    "extracted_summary",
    "address",
    "offerings",
    "error_message",
  ];
  const narrow: EvalTableColumnId[] = ["logos"];
  if (narrow.includes(columnId)) return "max-w-[7rem] py-2 pr-3 align-middle";
  if (wide.includes(columnId)) {
    return "max-w-[12rem] py-2 pr-3 whitespace-normal break-words align-middle";
  }
  return "max-w-[10rem] py-2 pr-3 align-middle";
}

export function EvalReviewTableColumnCell({
  columnId,
  row,
}: {
  columnId: EvalTableColumnId;
  row: BrandAuditRow;
}) {
  switch (columnId) {
    case "domain":
      return (
        <EvalSourceLink
          row={row}
          className="text-[12px] text-zinc-700"
          mono
          stopPropagation
        />
      );
    case "normalized_url":
      return (
        <EvalExternalLink
          href={safeHttpHref(row.normalized_url ?? "")}
          className="text-xs text-zinc-600"
          mono
          stopPropagation
        >
          {row.normalized_url?.trim() || "—"}
        </EvalExternalLink>
      );
    case "ds_number":
      return <TextFieldCell value={row.ds_number} />;
    case "project_title":
      return <TextFieldCell value={row.project_title} />;
    case "project_type":
      return <TextFieldCell value={row.project_type} />;
    case "shop_code":
      return <TextFieldCell value={row.shop_code} />;
    case "source_column":
      return <TextFieldCell value={row.source_column} />;
    case "extracted_business_name":
      return <TextFieldCell value={row.extracted_business_name} />;
    case "logos":
      return (
        <LogoThumbnailRow
          row={row}
          max={3}
          showExtraCount
          size="sm"
          emptyLabel="No logo"
        />
      );
    case "colors":
      return (
        <ColorSwatchRow row={row} max={5} compact emptyLabel="No palette" />
      );
    case "emails":
      return <EmailListCell row={row} />;
    case "phones":
      return <PhoneListCell row={row} />;
    case "social":
      return <SocialLinksCell row={row} />;
    case "address":
      return <AddressCell row={row} />;
    case "contact_links":
      return <ContactLinksCell row={row} />;
    case "offerings":
      return <OfferingsListCell row={row} />;
    case "extracted_summary":
      return <TextFieldCell value={row.extracted_summary} truncate={80} />;
    case "status":
      return <ReviewStatusPill status={row.status ?? ""} />;
    case "pages_inspected":
      return <TextFieldCell value={row.pages_inspected} />;
    case "elapsed_ms":
      return <TextFieldCell value={row.elapsed_ms} />;
    case "provider_model":
      return <ProviderModelCell row={row} />;
    case "error_message":
      return <TextFieldCell value={row.error_message} truncate={80} />;
    default:
      return <span className="text-zinc-400">—</span>;
  }
}
