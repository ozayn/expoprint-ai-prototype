import type { EvalTableColumnId } from "@/lib/evalLocal/evalTableColumns";

/** Expand affordance column (▸/▾). */
export const EVAL_TABLE_EXPAND_COL_WIDTH_PX = 28;

/** Fixed column widths for `table-layout: fixed` (pixels). */
export const EVAL_TABLE_COLUMN_WIDTHS_PX: Record<EvalTableColumnId, number> = {
  domain: 200,
  normalized_url: 200,
  ds_number: 88,
  project_title: 180,
  project_type: 96,
  shop_code: 88,
  source_column: 104,
  extracted_business_name: 200,
  logos: 104,
  colors: 112,
  emails: 140,
  phones: 120,
  social: 104,
  address: 160,
  contact_links: 140,
  offerings: 168,
  extracted_summary: 200,
  status: 88,
  pages_inspected: 72,
  elapsed_ms: 72,
  provider_model: 128,
  error_message: 180,
};

export const EVAL_AUDIT_TABLE_SCROLL_CLASS =
  "-mx-1 overflow-x-auto overscroll-x-contain px-1";

export const EVAL_AUDIT_TABLE_CLASS =
  "w-full border-collapse text-left text-[13px] table-fixed";

export function evalAuditTableMinWidthPx(columns: EvalTableColumnId[]): number {
  return (
    EVAL_TABLE_EXPAND_COL_WIDTH_PX +
    columns.reduce((sum, id) => sum + EVAL_TABLE_COLUMN_WIDTHS_PX[id], 0)
  );
}

export function evalTableCellClass(): string {
  return "max-w-0 py-2 pr-3 align-top overflow-hidden";
}

export function evalTableExpandHeaderClass(): string {
  return "w-7 pb-2 pr-1 font-normal";
}

export function evalTableExpandCellClass(): string {
  return "w-7 py-2 pr-1 text-[10px] text-zinc-300";
}

export function evalTableHeaderClass(): string {
  return "pb-2 pr-3 font-normal overflow-hidden";
}

/** Single-line truncated text with optional tooltip. */
export const EVAL_TABLE_TRUNCATE_CLASS =
  "block min-w-0 truncate [overflow-wrap:anywhere]";

/** Up to two lines with break-friendly wrapping. */
export const EVAL_TABLE_CLAMP_2_CLASS =
  "block min-w-0 line-clamp-2 break-words [overflow-wrap:anywhere]";

/** Up to three lines for list-style cells. */
export const EVAL_TABLE_CLAMP_3_CLASS =
  "line-clamp-3 break-words [overflow-wrap:anywhere]";
