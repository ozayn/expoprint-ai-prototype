"use client";

import { useState } from "react";
import {
  ColorSwatch,
  LogoCandidateDetailList,
  PaletteSourceLine,
} from "./BrandExtractionCells";
import { EvalSourceLink, EvalUrlDetailField } from "./EvalExternalLink";
import {
  bestLogoForRow,
  colorEntriesForRow,
  extraLogoCandidateCount,
  isPartialOrFailedStatus,
  proxiedEvalImageSrc,
} from "@/lib/evalLocal/brandExtractionParse";
import {
  offeringsForRow,
  productsForRow,
  servicesForRow,
} from "@/lib/evalLocal/offeringsExtractionParse";
import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";
import { EvalDetailField } from "./EvalViewerField";

export function BrandAuditCard({
  row,
  omitPartnerFields = false,
}: {
  row: BrandAuditRow;
  omitPartnerFields?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const businessName = row.extracted_business_name?.trim() || "—";
  const bestLogo = bestLogoForRow(row);
  const extraLogos = extraLogoCandidateCount(row);
  const colors = colorEntriesForRow(row);
  const status = row.status?.trim() ?? "";
  const statusLabel = status ? status.replace(/_/g, " ") : "";

  const providerModel = [row.extraction_provider, row.extraction_model]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(" · ");

  const products = productsForRow(row);
  const services = servicesForRow(row);
  const offerings = offeringsForRow(row);
  const hasOfferings =
    products.length > 0 || services.length > 0 || offerings.length > 0;

  const hasScores =
    row.business_name_score.trim() ||
    row.category_score.trim() ||
    row.logo_score.trim() ||
    row.brief_score.trim() ||
    row.overall_score.trim() ||
    row.reviewer_notes.trim();

  return (
    <article className="rounded-lg border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-100/50">
      <div className="space-y-4">
        <div>
          <EvalSourceLink row={row} className="text-sm text-zinc-700" mono />
          <p className="mt-1 text-base font-medium leading-snug text-zinc-900">
            {businessName}
          </p>
          {statusLabel ? (
            <p
              className={`mt-1.5 text-xs ${
                isPartialOrFailedStatus(status) ? "text-zinc-500" : "text-zinc-400"
              }`}
            >
              {statusLabel}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-center justify-center py-2">
          {bestLogo ? (
            <>
              <div className="flex h-20 w-full max-w-[10rem] items-center justify-center rounded border border-zinc-100 bg-zinc-50/50 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proxiedEvalImageSrc(bestLogo.url)}
                  alt=""
                  className="max-h-16 max-w-full object-contain"
                  loading="lazy"
                />
              </div>
              {extraLogos > 0 ? (
                <p className="mt-2 text-[11px] text-zinc-400">
                  +{extraLogos} candidate{extraLogos === 1 ? "" : "s"}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-zinc-400">No logo detected</p>
          )}
        </div>

        <div>
          {colors.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-2">
              {colors.map((entry) => (
                <ColorSwatch key={`${entry.hex}-${entry.label ?? ""}`} entry={entry} />
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-zinc-400">Palette unavailable</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-xs text-zinc-400 transition-colors hover:text-zinc-600 focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300"
        >
          {open ? "Hide details" : "Details"}
        </button>
      </div>

      {open ? (
        <div className="mt-5 space-y-6 border-t border-zinc-100 pt-5 text-sm">
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Source
            </h4>
            <dl className="mt-2 space-y-2">
              <EvalUrlDetailField label="normalized url" value={row.normalized_url} row={row} />
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
                label="ds number"
                value={row.ds_number}
                omitted={omitPartnerFields}
              />
            </dl>
          </div>

          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Identity
            </h4>
            <dl className="mt-2 space-y-2">
              <EvalDetailField label="business name" value={row.extracted_business_name} />
              <EvalDetailField label="category" value={row.extracted_business_category} />
              <EvalDetailField label="tagline" value={row.extracted_tagline} />
              <EvalDetailField label="summary" value={row.extracted_summary} />
            </dl>
          </div>

          {hasOfferings ? (
            <div>
              <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                Offerings
              </h4>
              <dl className="mt-2 space-y-2">
                {products.length > 0 ? (
                  <div>
                    <dt className="text-[11px] text-zinc-400">products</dt>
                    <dd className="mt-1 space-y-1 text-sm text-zinc-800">
                      {products.map((item) => (
                        <span key={item} className="block">{item}</span>
                      ))}
                    </dd>
                  </div>
                ) : null}
                {services.length > 0 ? (
                  <div>
                    <dt className="text-[11px] text-zinc-400">services</dt>
                    <dd className="mt-1 space-y-1 text-sm text-zinc-800">
                      {services.map((item) => (
                        <span key={item} className="block">{item}</span>
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
            <div className="mt-2 space-y-3">
              <LogoCandidateDetailList row={row} />
              {colors.length > 0 ? (
                <div className="space-y-1">
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                    {colors.map((entry) => (
                      <ColorSwatch key={`d-${entry.hex}`} entry={entry} />
                    ))}
                  </div>
                  <PaletteSourceLine row={row} />
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
              Technical
            </h4>
            <dl className="mt-2 space-y-2">
              <EvalDetailField label="status" value={row.status} />
              <EvalDetailField label="pages inspected" value={row.pages_inspected} />
              <EvalDetailField label="elapsed ms" value={row.elapsed_ms} />
              <EvalDetailField label="provider / model" value={providerModel} />
              <EvalDetailField label="error" value={row.error_message} />
            </dl>
          </div>

          <details>
            <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-600">
              Manual scores
            </summary>
            {hasScores ? (
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <EvalDetailField label="business name score" value={row.business_name_score} />
                <EvalDetailField label="category score" value={row.category_score} />
                <EvalDetailField label="logo score" value={row.logo_score} />
                <EvalDetailField label="brief score" value={row.brief_score} />
                <EvalDetailField label="overall score" value={row.overall_score} />
                <EvalDetailField label="reviewer notes" value={row.reviewer_notes} />
              </dl>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">No manual scores in CSV.</p>
            )}
          </details>
        </div>
      ) : null}
    </article>
  );
}
