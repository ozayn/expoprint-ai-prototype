"use client";

import { EvalExternalLink } from "./EvalExternalLink";
import { EvalReviewTableColumnCell } from "./EvalReviewTableCells";
import { safeHttpHref } from "@/lib/evalLocal/evalRowUrl";
import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";
import type { EvalTableColumnId } from "@/lib/evalLocal/evalTableColumns";
import type { UrlCandidateRow } from "@/lib/evalLocal/urlCandidateTypes";
import type { UrlInventoryExtractionStatus } from "@/lib/evalLocal/urlInventoryJoin";
import { EVAL_TABLE_TRUNCATE_CLASS } from "./evalTableLayout";

function CandidateSourceLink({
  candidate,
  stopPropagation,
}: {
  candidate: UrlCandidateRow;
  stopPropagation?: boolean;
}) {
  const href = safeHttpHref(candidate.normalized_url ?? "");
  const label =
    candidate.domain?.trim() ||
    candidate.canonical_domain?.trim() ||
    candidate.normalized_url?.trim() ||
    "—";
  return (
    <EvalExternalLink
      href={href}
      mono
      className={`${EVAL_TABLE_TRUNCATE_CLASS} text-[12px] text-zinc-700`}
      stopPropagation={stopPropagation}
      title={label !== "—" ? label : undefined}
    >
      {label}
    </EvalExternalLink>
  );
}

function InventoryStatusPill({ status }: { status: UrlInventoryExtractionStatus }) {
  if (status === "not_run") {
    return (
      <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
        Not run
      </span>
    );
  }
  if (status === "success") {
    return (
      <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
        Success
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
      Failed
    </span>
  );
}

function CandidateTextCell({ value }: { value: string | undefined }) {
  const v = (value ?? "").trim();
  return (
    <span className={`${EVAL_TABLE_TRUNCATE_CLASS} text-zinc-800`} title={v || undefined}>
      {v || "—"}
    </span>
  );
}

function NotRunDataPlaceholder() {
  return <span className="text-[11px] text-zinc-400">No data yet</span>;
}

const CANDIDATE_TEXT_COLUMNS: EvalTableColumnId[] = [
  "ds_number",
  "project_title",
  "project_type",
  "shop_code",
  "source_column",
];

const EXTRACTED_COLUMNS: EvalTableColumnId[] = [
  "extracted_business_name",
  "logos",
  "colors",
  "emails",
  "phones",
  "social",
  "address",
  "contact_links",
  "offerings",
  "extracted_summary",
  "pages_inspected",
  "elapsed_ms",
  "provider_model",
  "error_message",
];

function candidateFieldForColumn(
  candidate: UrlCandidateRow,
  columnId: EvalTableColumnId,
): string | undefined {
  switch (columnId) {
    case "ds_number":
      return candidate.ds_number;
    case "project_title":
      return candidate.project_title;
    case "project_type":
      return candidate.project_type;
    case "shop_code":
      return candidate.shop_code;
    case "source_column":
      return candidate.source_column;
    default:
      return undefined;
  }
}

const PARTNER_CANDIDATE_COLUMNS: EvalTableColumnId[] = [
  "ds_number",
  "shop_code",
];

export function EvalInventoryTableColumnCell({
  columnId,
  candidate,
  review,
  extractionStatus,
  omitPartnerFields = false,
}: {
  columnId: EvalTableColumnId;
  candidate: UrlCandidateRow;
  review: BrandAuditRow | null | undefined;
  extractionStatus: UrlInventoryExtractionStatus;
  omitPartnerFields?: boolean;
}) {
  if (omitPartnerFields && PARTNER_CANDIDATE_COLUMNS.includes(columnId)) {
    return <span className="text-zinc-400">—</span>;
  }
  if (columnId === "domain") {
    return <CandidateSourceLink candidate={candidate} stopPropagation />;
  }

  if (columnId === "normalized_url") {
    const url = candidate.normalized_url?.trim() || "—";
    return (
      <EvalExternalLink
        href={safeHttpHref(candidate.normalized_url ?? "")}
        className={`${EVAL_TABLE_TRUNCATE_CLASS} text-xs text-zinc-600`}
        mono
        stopPropagation
        title={url !== "—" ? url : undefined}
      >
        {url}
      </EvalExternalLink>
    );
  }

  if (CANDIDATE_TEXT_COLUMNS.includes(columnId)) {
    return (
      <CandidateTextCell value={candidateFieldForColumn(candidate, columnId)} />
    );
  }

  if (columnId === "status") {
    return <InventoryStatusPill status={extractionStatus} />;
  }

  if (EXTRACTED_COLUMNS.includes(columnId)) {
    if (!review) {
      return <NotRunDataPlaceholder />;
    }
    return <EvalReviewTableColumnCell columnId={columnId} row={review} />;
  }

  return <span className="text-zinc-400">—</span>;
}
