import {
  colorEntriesForRow,
  parseLogoCandidatesJson,
} from "./brandExtractionParse";
import type { BrandAuditRow } from "./brandAuditRow";
import {
  addressesForRow,
  emailsForRow,
  phonesForRow,
  socialLinksForRow,
} from "./contactExtractionParse";
import { hasOfferingsForRow } from "./offeringsExtractionParse";

export type ExtractionCoverageFieldId =
  | "business_name"
  | "logos"
  | "colors"
  | "emails"
  | "phones"
  | "social"
  | "address"
  | "products_services"
  | "summary";

export type ExtractionCoverageField = {
  id: ExtractionCoverageFieldId;
  label: string;
  count: number;
  percent: number;
};

export type ExtractionCoverageSummary = {
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  fields: ExtractionCoverageField[];
  strong: string[];
  needsWork: string[];
};

const FIELD_LABELS: Record<ExtractionCoverageFieldId, string> = {
  business_name: "Business name",
  logos: "Logos",
  colors: "Colors",
  emails: "Emails",
  phones: "Phones",
  social: "Social",
  address: "Address",
  products_services: "Products / services",
  summary: "Summary",
};

function isSuccessfulRow(row: BrandAuditRow): boolean {
  return row.status?.trim() === "success";
}

function hasLogosForRow(row: BrandAuditRow): boolean {
  if (row.selected_logo_url?.trim()) return true;
  if (parseLogoCandidatesJson(row.logo_candidate_urls ?? "").length > 0) return true;
  const count = Number.parseInt(row.logo_candidate_count ?? "", 10);
  return Number.isFinite(count) && count > 0;
}

function hasColorsForRow(row: BrandAuditRow): boolean {
  if (colorEntriesForRow(row).length > 0) return true;
  return Boolean(
    row.primary_color_hex?.trim() || row.secondary_color_hex?.trim(),
  );
}

function hasAddressForRow(row: BrandAuditRow): boolean {
  return addressesForRow(row).length > 0;
}

const FIELD_DETECTORS: Record<
  ExtractionCoverageFieldId,
  (row: BrandAuditRow) => boolean
> = {
  business_name: (row) => Boolean(row.extracted_business_name?.trim()),
  logos: hasLogosForRow,
  colors: hasColorsForRow,
  emails: (row) => emailsForRow(row).length > 0,
  phones: (row) => phonesForRow(row).length > 0,
  social: (row) => socialLinksForRow(row).length > 0,
  address: hasAddressForRow,
  products_services: hasOfferingsForRow,
  summary: (row) => Boolean(row.extracted_summary?.trim()),
};

export function computeExtractionCoverage(
  rows: BrandAuditRow[],
): ExtractionCoverageSummary {
  const totalRows = rows.length;
  const successful = rows.filter(isSuccessfulRow);
  const successfulRows = successful.length;
  const failedRows = totalRows - successfulRows;

  const fieldIds = Object.keys(FIELD_LABELS) as ExtractionCoverageFieldId[];
  const fields: ExtractionCoverageField[] = fieldIds.map((id) => {
    const count =
      successfulRows === 0
        ? 0
        : successful.filter((row) => FIELD_DETECTORS[id](row)).length;
    const percent =
      successfulRows === 0 ? 0 : Math.round((count / successfulRows) * 100);
    return {
      id,
      label: FIELD_LABELS[id],
      count,
      percent,
    };
  });

  const strong = fields
    .filter((f) => successfulRows > 0 && f.percent >= 80)
    .map((f) => f.label);
  const needsWork = fields
    .filter((f) => successfulRows > 0 && f.percent < 50)
    .map((f) => f.label);

  return {
    totalRows,
    successfulRows,
    failedRows,
    fields,
    strong,
    needsWork,
  };
}
