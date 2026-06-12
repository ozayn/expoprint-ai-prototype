import type { BrandAuditRow } from "./brandAuditRow";
import { FIELD_HAS_DETECTORS } from "./fieldCoverageHelpers";

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
        : successful.filter((row) => FIELD_HAS_DETECTORS[id](row)).length;
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
