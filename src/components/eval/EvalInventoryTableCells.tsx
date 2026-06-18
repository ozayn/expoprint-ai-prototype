"use client";

import { EvalSourceUrlDisplay } from "./EvalSourceUrlDisplay";
import { EvalReviewTableColumnCell } from "./EvalReviewTableCells";
import { EvalTableStatusCell } from "./EvalTableStatusCell";
import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";
import type { EvalTableColumnId } from "@/lib/evalLocal/evalTableColumns";
import { parseSourceUrlDisplayFromCandidate } from "@/lib/evalLocal/evalSourceUrlDisplay";
import type { UrlCandidateRow } from "@/lib/evalLocal/urlCandidateTypes";
import type { UrlInventoryProcessedMeta } from "@/lib/evalLocal/evalProcessedMeta";
import type { UrlInventoryExtractionStatus } from "@/lib/evalLocal/urlInventoryJoin";
import { EVAL_TABLE_TRUNCATE_CLASS } from "./evalTableLayout";

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
  processedMeta,
  omitPartnerFields = false,
}: {
  columnId: EvalTableColumnId;
  candidate: UrlCandidateRow;
  review: BrandAuditRow | null | undefined;
  extractionStatus: UrlInventoryExtractionStatus;
  processedMeta?: UrlInventoryProcessedMeta | null;
  omitPartnerFields?: boolean;
}) {
  if (omitPartnerFields && PARTNER_CANDIDATE_COLUMNS.includes(columnId)) {
    return <span className="text-zinc-400">—</span>;
  }
  if (columnId === "domain") {
    return (
      <EvalSourceUrlDisplay
        display={parseSourceUrlDisplayFromCandidate(candidate)}
        mono
        stopPropagation
      />
    );
  }

  if (columnId === "normalized_url") {
    return (
      <EvalSourceUrlDisplay
        display={parseSourceUrlDisplayFromCandidate(candidate)}
        mono
        stopPropagation
      />
    );
  }

  if (CANDIDATE_TEXT_COLUMNS.includes(columnId)) {
    return (
      <CandidateTextCell value={candidateFieldForColumn(candidate, columnId)} />
    );
  }

  if (columnId === "status") {
    return (
      <EvalTableStatusCell
        category={extractionStatus}
        processedMeta={processedMeta}
      />
    );
  }

  if (EXTRACTED_COLUMNS.includes(columnId)) {
    if (!review) {
      return <NotRunDataPlaceholder />;
    }
    return <EvalReviewTableColumnCell columnId={columnId} row={review} />;
  }

  return <span className="text-zinc-400">—</span>;
}
