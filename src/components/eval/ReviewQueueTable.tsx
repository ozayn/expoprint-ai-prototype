"use client";

import { useMemo, useState } from "react";
import {
  ColorSwatchRow,
  LogoCandidateDetailList,
  PaletteSourceLine,
} from "./BrandExtractionCells";
import { EvalDetailField } from "./EvalViewerField";
import { DuplicateUrlVariantsDetail } from "./DuplicateUrlVariantsDetail";
import { EvalUrlDetailField } from "./EvalExternalLink";
import {
  contactLinksForRow,
  emailsForRow,
  phonesForRow,
  socialLinksForRow,
  addressesForRow,
} from "@/lib/evalLocal/contactExtractionParse";
import {
  offeringsForRow,
  productsForRow,
  servicesForRow,
} from "@/lib/evalLocal/offeringsExtractionParse";
import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";
import { parseDuplicateVariants } from "@/lib/evalLocal/evalCanonicalDedup";
import {
  countBrandAuditRowsByStatus,
  filterBrandAuditRows,
  normalizedStatusFromReviewRow,
} from "@/lib/evalLocal/evalRowFilters";
import {
  evalTableColumnHeaderLabel,
  type EvalTableColumnId,
} from "@/lib/evalLocal/evalTableColumns";
import { EvalColumnPicker } from "./EvalColumnPicker";
import { useOrderedVisibleEvalColumns } from "./EvalColumnVisibilityContext";
import { EvalTableColGroup } from "./EvalTableColGroup";
import { EvalReviewTableColumnCell } from "./EvalReviewTableCells";
import {
  EVAL_AUDIT_TABLE_CLASS,
  EVAL_AUDIT_TABLE_SCROLL_CLASS,
  evalAuditTableMinWidthPx,
  evalTableCellClass,
  evalTableExpandCellClass,
  evalTableExpandHeaderClass,
  evalTableHeaderClass,
} from "./evalTableLayout";
import { EvalFilterControls } from "./EvalFilterControls";
import { useOptionalEvalViewerFilters } from "./EvalViewerFilterContext";
import {
  newestSourceReviewQueueFromSources,
  resolveSourceReviewQueueFromReview,
} from "@/lib/evalLocal/evalProcessedMeta";

type Props = {
  filename: string;
  rows: BrandAuditRow[];
  omitPartnerFields?: boolean;
};

export function ReviewQueueTable({
  filename,
  rows,
  omitPartnerFields = false,
}: Props) {
  const filterCtx = useOptionalEvalViewerFilters();
  const paginationKey = filterCtx?.paginationKey ?? 0;
  const [expandedRow, setExpandedRow] = useState<{
    paginationKey: number;
    index: number;
  } | null>(null);

  const visibleColumns = useOrderedVisibleEvalColumns({
    omitPartnerFields,
  });

  const newestSourceReviewQueue = useMemo(() => {
    const sources = rows.map((row) =>
      resolveSourceReviewQueueFromReview(row, {
        fallbackReviewQueueFilename: filename,
      }),
    );
    return newestSourceReviewQueueFromSources(sources);
  }, [rows, filename]);

  const colSpan = visibleColumns.length + 1; /* expand */
  const expandedIndex =
    expandedRow?.paginationKey === paginationKey ? expandedRow.index : null;

  const statusCounts = useMemo(() => countBrandAuditRowsByStatus(rows), [rows]);

  const filtered = useMemo(() => {
    if (!filterCtx) return rows;
    return filterBrandAuditRows(rows, {
      search: filterCtx.search,
      statusFilter: filterCtx.statusFilter,
      fieldFilters: filterCtx.fieldFilters,
    });
  }, [rows, filterCtx]);

  const successfulInFiltered = filtered.filter(
    (r) => normalizedStatusFromReviewRow(r) === "success",
  ).length;

  const processedMatchLine =
    filterCtx &&
    filterCtx.fieldFilters.length > 0 &&
    successfulInFiltered > 0
      ? `${successfulInFiltered.toLocaleString()} successful rows match field filters (field filters apply to processed rows with extraction data)`
      : filterCtx && filterCtx.fieldFilters.length > 0
        ? "Field filters apply to processed rows with extraction data"
        : undefined;

  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500">No review rows to display.</p>
    );
  }

  return (
    <div>
      {filterCtx ? (
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <EvalFilterControls
                showNotRunStatus={false}
                searchPlaceholder="Search domain, URL, project, business…"
                resultCountLine={`Showing ${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} rows`}
                processedMatchLine={processedMatchLine}
                statusCounts={statusCounts}
              />
            </div>
            <EvalColumnPicker omitPartnerFields={omitPartnerFields} />
          </div>
        </div>
      ) : (
        <div className="mb-4 flex justify-end">
          <EvalColumnPicker omitPartnerFields={omitPartnerFields} />
        </div>
      )}

      <div className={EVAL_AUDIT_TABLE_SCROLL_CLASS}>
        <table
          className={EVAL_AUDIT_TABLE_CLASS}
          style={{ minWidth: evalAuditTableMinWidthPx(visibleColumns) }}
        >
          <EvalTableColGroup columns={visibleColumns} />
          <thead>
            <tr className="border-b border-zinc-200 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              <th className={evalTableExpandHeaderClass()} aria-label="Expand" />
              {visibleColumns.map((columnId) => (
                <th key={columnId} className={evalTableHeaderClass()}>
                  {evalTableColumnHeaderLabel(columnId)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => {
              const expanded = expandedIndex === i;
              return (
                <RowGroup
                  key={i}
                  row={row}
                  expanded={expanded}
                  colSpan={colSpan}
                  visibleColumns={visibleColumns}
                  omitPartnerFields={omitPartnerFields}
                  newestSourceReviewQueue={newestSourceReviewQueue}
                  reviewQueueFilename={filename}
                  onToggle={() =>
                    setExpandedRow(
                      expandedIndex === i ? null : { paginationKey, index: i },
                    )
                  }
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
  visibleColumns,
  omitPartnerFields,
  newestSourceReviewQueue,
  reviewQueueFilename,
  onToggle,
}: {
  row: BrandAuditRow;
  expanded: boolean;
  colSpan: number;
  visibleColumns: EvalTableColumnId[];
  omitPartnerFields: boolean;
  newestSourceReviewQueue: string | null;
  reviewQueueFilename: string;
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
        <td className={evalTableExpandCellClass()}>
          {expanded ? "▾" : "▸"}
        </td>
        {visibleColumns.map((columnId) => (
          <td key={columnId} className={evalTableCellClass()}>
            <EvalReviewTableColumnCell
              columnId={columnId}
              row={row}
              newestSourceReviewQueue={newestSourceReviewQueue}
              reviewQueueFilename={reviewQueueFilename}
            />
          </td>
        ))}
      </tr>
      {expanded ? (
        <tr className="border-b border-zinc-100 bg-zinc-50/40">
          <td colSpan={colSpan} className="px-1 py-5">
            <ExpandedRowDetails row={row} omitPartnerFields={omitPartnerFields} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function ExpandedRowDetails({
  row,
  omitPartnerFields = false,
}: {
  row: BrandAuditRow;
  omitPartnerFields?: boolean;
}) {
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

  const products = productsForRow(row);
  const services = servicesForRow(row);
  const offerings = offeringsForRow(row);
  const hasOfferings =
    products.length > 0 || services.length > 0 || offerings.length > 0;

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
            <EvalDetailField
              label="ds number"
              value={row.ds_number}
              omitted={omitPartnerFields}
            />
            <EvalDetailField
              label="project title"
              value={row.project_title}
              omitted={omitPartnerFields}
            />
            <EvalDetailField
              label="project type"
              value={row.project_type}
              omitted={omitPartnerFields && !row.project_type.trim()}
            />
            <EvalDetailField
              label="shop code"
              value={row.shop_code}
              omitted={omitPartnerFields}
            />
            <EvalUrlDetailField label="normalized url" value={row.normalized_url} row={row} />
            <DuplicateUrlVariantsDetail
              variants={parseDuplicateVariants(row.duplicate_source_urls)}
              label="Duplicate source URLs"
            />
          </dl>
        </div>

        <div>
          <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
            Technical
          </h4>
          <dl className="mt-2 space-y-2 text-sm text-zinc-800">
            <EvalDetailField label="pages inspected" value={row.pages_inspected} />
            <EvalDetailField label="provider / model" value={providerModel} />
            <EvalDetailField label="elapsed ms" value={row.elapsed_ms} />
            <EvalDetailField label="error" value={row.error_message} />
          </dl>
        </div>

        {hasIdentity ? (
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Identity
            </h4>
            <dl className="mt-2 space-y-2 text-sm text-zinc-800">
              <EvalDetailField label="category" value={row.extracted_business_category} />
              <EvalDetailField label="summary" value={row.extracted_summary} />
              <EvalDetailField label="tagline" value={row.extracted_tagline} />
            </dl>
          </div>
        ) : null}

        {hasOfferings ? (
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Offerings
            </h4>
            <dl className="mt-2 space-y-2 text-sm text-zinc-800">
              {products.length > 0 ? (
                <div>
                  <dt className="text-[11px] text-zinc-400">products</dt>
                  <dd className="mt-1 space-y-1">
                    {products.map((item) => (
                      <span key={item} className="block">{item}</span>
                    ))}
                  </dd>
                </div>
              ) : null}
              {services.length > 0 ? (
                <div>
                  <dt className="text-[11px] text-zinc-400">services</dt>
                  <dd className="mt-1 space-y-1">
                    {services.map((item) => (
                      <span key={item} className="block">{item}</span>
                    ))}
                  </dd>
                </div>
              ) : null}
              {offerings.length > 0 ? (
                <div>
                  <dt className="text-[11px] text-zinc-400">combined</dt>
                  <dd className="mt-1 space-y-1">
                    {offerings.map((item) => (
                      <span key={item} className="block">{item}</span>
                    ))}
                  </dd>
                </div>
              ) : null}
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
              <div className="mt-2">
                <PaletteSourceLine row={row} />
              </div>
            </div>
            <EvalDetailField
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
            <EvalDetailField label="business name score" value={row.business_name_score} />
            <EvalDetailField label="category score" value={row.category_score} />
            <EvalDetailField label="logo score" value={row.logo_score} />
            <EvalDetailField label="brief score" value={row.brief_score} />
            <EvalDetailField label="overall score" value={row.overall_score} />
            <EvalDetailField label="reviewer notes" value={row.reviewer_notes} />
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
