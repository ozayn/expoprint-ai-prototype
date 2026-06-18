"use client";

import {
  ColorSwatchRow,
  LogoThumbnailRow,
  PaletteSourceLine,
} from "./BrandExtractionCells";
import { paletteSourceCellDisplay } from "@/lib/evalLocal/paletteSourceDisplay";
import {
  AddressCell,
  ContactLinksCell,
  EmailListCell,
  OfferingsListCell,
  PhoneListCell,
  SocialLinksCell,
} from "./ContactTableCells";
import { EvalSourceUrlDisplay } from "./EvalSourceUrlDisplay";
import { EvalTableStatusCell, reviewRowStatusCategory } from "./EvalTableStatusCell";
import type { BrandAuditRow } from "@/lib/evalLocal/brandAuditRow";
import type { EvalTableColumnId } from "@/lib/evalLocal/evalTableColumns";
import { processedMetaFromReviewRow } from "@/lib/evalLocal/evalProcessedMeta";
import { parseSourceUrlDisplayFromReviewRow } from "@/lib/evalLocal/evalSourceUrlDisplay";
import {
  EVAL_TABLE_CLAMP_2_CLASS,
  EVAL_TABLE_TRUNCATE_CLASS,
} from "./evalTableLayout";

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
  newestSourceReviewQueue,
  reviewQueueFilename,
}: {
  columnId: EvalTableColumnId;
  row: BrandAuditRow;
  newestSourceReviewQueue?: string | null;
  reviewQueueFilename?: string;
}) {
  switch (columnId) {
    case "domain":
      return (
        <EvalSourceUrlDisplay
          display={parseSourceUrlDisplayFromReviewRow(row)}
          mono
          stopPropagation
        />
      );
    case "normalized_url":
      return (
        <EvalSourceUrlDisplay
          display={parseSourceUrlDisplayFromReviewRow(row)}
          mono
          stopPropagation
        />
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
        <div className="min-w-0 max-w-full overflow-hidden space-y-1">
          <ColorSwatchRow row={row} max={4} compact emptyLabel="No palette" />
          <PaletteSourceLine row={row} />
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
    case "palette_source":
      return <TextFieldCell value={paletteSourceCellDisplay(row)} />;
    case "palette_confidence":
      return <TextFieldCell value={row.palette_confidence} />;
    case "status": {
      const category = reviewRowStatusCategory(row.status ?? "");
      const processedMeta =
        category === "not_run"
          ? null
          : processedMetaFromReviewRow(row, {
              fallbackReviewQueueFilename: reviewQueueFilename,
              newestSourceReviewQueue,
            });
      return (
        <EvalTableStatusCell category={category} processedMeta={processedMeta} />
      );
    }
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
