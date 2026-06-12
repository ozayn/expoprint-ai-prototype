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
import {
  EVAL_TABLE_CLAMP_2_CLASS,
  EVAL_TABLE_TRUNCATE_CLASS,
} from "./evalTableLayout";

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
  maxLines = 1,
}: {
  value: string;
  maxLines?: 1 | 2;
}) {
  const v = value.trim();
  const className =
    maxLines === 2 ? EVAL_TABLE_CLAMP_2_CLASS : EVAL_TABLE_TRUNCATE_CLASS;
  return (
    <span className={`${className} text-zinc-800`} title={v || undefined}>
      {v || "—"}
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
          className={`${EVAL_TABLE_TRUNCATE_CLASS} text-[12px] text-zinc-700`}
          mono
          stopPropagation
        />
      );
    case "normalized_url": {
      const normalizedUrl = row.normalized_url?.trim() || "—";
      return (
        <EvalExternalLink
          href={safeHttpHref(row.normalized_url ?? "")}
          className={`${EVAL_TABLE_TRUNCATE_CLASS} text-xs text-zinc-600`}
          mono
          stopPropagation
          title={normalizedUrl !== "—" ? normalizedUrl : undefined}
        >
          {normalizedUrl}
        </EvalExternalLink>
      );
    }
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
      return <TextFieldCell value={row.extracted_business_name} maxLines={2} />;
    case "logos":
      return (
        <div className="min-w-0 max-w-full overflow-hidden">
          <LogoThumbnailRow
            row={row}
            max={2}
            showExtraCount
            size="sm"
            emptyLabel="No logo"
          />
        </div>
      );
    case "colors":
      return (
        <div className="min-w-0 max-w-full overflow-hidden">
          <ColorSwatchRow row={row} max={4} compact emptyLabel="No palette" />
        </div>
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
      return <TextFieldCell value={row.extracted_summary} maxLines={2} />;
    case "status":
      return <ReviewStatusPill status={row.status ?? ""} />;
    case "pages_inspected":
      return <TextFieldCell value={row.pages_inspected} />;
    case "elapsed_ms":
      return <TextFieldCell value={row.elapsed_ms} />;
    case "provider_model":
      return <ProviderModelCell row={row} />;
    case "error_message":
      return <TextFieldCell value={row.error_message} maxLines={2} />;
    default:
      return <span className="text-zinc-400">—</span>;
  }
}
