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
import type { ExtractionCoverageFieldId } from "./extractionCoverage";
import type { UrlInventoryExtractionStatus } from "./urlInventoryJoin";

export function hasBusinessName(row: BrandAuditRow): boolean {
  return Boolean(row.extracted_business_name?.trim());
}

export function hasLogo(row: BrandAuditRow): boolean {
  if (row.selected_logo_url?.trim()) return true;
  if (parseLogoCandidatesJson(row.logo_candidate_urls ?? "").length > 0) return true;
  const count = Number.parseInt(row.logo_candidate_count ?? "", 10);
  return Number.isFinite(count) && count > 0;
}

export function hasColors(row: BrandAuditRow): boolean {
  if (colorEntriesForRow(row).length > 0) return true;
  return Boolean(row.primary_color_hex?.trim() || row.secondary_color_hex?.trim());
}

export function hasEmail(row: BrandAuditRow): boolean {
  return emailsForRow(row).length > 0;
}

export function hasPhone(row: BrandAuditRow): boolean {
  return phonesForRow(row).length > 0;
}

export function hasSocialLinks(row: BrandAuditRow): boolean {
  return socialLinksForRow(row).length > 0;
}

export function hasAddress(row: BrandAuditRow): boolean {
  return addressesForRow(row).length > 0;
}

export function hasProductsServices(row: BrandAuditRow): boolean {
  return hasOfferingsForRow(row);
}

export function hasSummary(row: BrandAuditRow): boolean {
  return Boolean(row.extracted_summary?.trim());
}

export const FIELD_HAS_DETECTORS: Record<
  ExtractionCoverageFieldId,
  (row: BrandAuditRow) => boolean
> = {
  business_name: hasBusinessName,
  logos: hasLogo,
  colors: hasColors,
  emails: hasEmail,
  phones: hasPhone,
  social: hasSocialLinks,
  address: hasAddress,
  products_services: hasProductsServices,
  summary: hasSummary,
};

export type FieldFilterId =
  | "missing_logo"
  | "missing_colors"
  | "missing_business_name"
  | "missing_email"
  | "missing_phone"
  | "missing_social"
  | "missing_address"
  | "missing_products_services"
  | "missing_summary"
  | "has_logo"
  | "has_colors"
  | "has_business_name"
  | "has_email"
  | "has_phone"
  | "has_social"
  | "has_products_services"
  | "has_summary";

export type FieldFilterOption = {
  id: FieldFilterId;
  label: string;
  coverageFieldId?: ExtractionCoverageFieldId;
};

export const FIELD_FILTER_OPTIONS: FieldFilterOption[] = [
  { id: "missing_logo", label: "Missing logo", coverageFieldId: "logos" },
  { id: "missing_colors", label: "Missing colors", coverageFieldId: "colors" },
  {
    id: "missing_business_name",
    label: "Missing business name",
    coverageFieldId: "business_name",
  },
  { id: "missing_email", label: "Missing email", coverageFieldId: "emails" },
  { id: "missing_phone", label: "Missing phone", coverageFieldId: "phones" },
  { id: "missing_social", label: "Missing social links", coverageFieldId: "social" },
  { id: "missing_address", label: "Missing address", coverageFieldId: "address" },
  {
    id: "missing_products_services",
    label: "Missing products/services",
    coverageFieldId: "products_services",
  },
  { id: "missing_summary", label: "Missing summary", coverageFieldId: "summary" },
  { id: "has_logo", label: "Has logo", coverageFieldId: "logos" },
  { id: "has_colors", label: "Has colors", coverageFieldId: "colors" },
  {
    id: "has_business_name",
    label: "Has business name",
    coverageFieldId: "business_name",
  },
  { id: "has_email", label: "Has email", coverageFieldId: "emails" },
  { id: "has_phone", label: "Has phone", coverageFieldId: "phones" },
  { id: "has_social", label: "Has social links", coverageFieldId: "social" },
  {
    id: "has_products_services",
    label: "Has products/services",
    coverageFieldId: "products_services",
  },
  { id: "has_summary", label: "Has summary", coverageFieldId: "summary" },
];

export function fieldFilterLabel(id: FieldFilterId): string {
  return FIELD_FILTER_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

function matchesSingleFieldFilter(row: BrandAuditRow, filterId: FieldFilterId): boolean {
  switch (filterId) {
    case "missing_logo":
      return !hasLogo(row);
    case "missing_colors":
      return !hasColors(row);
    case "missing_business_name":
      return !hasBusinessName(row);
    case "missing_email":
      return !hasEmail(row);
    case "missing_phone":
      return !hasPhone(row);
    case "missing_social":
      return !hasSocialLinks(row);
    case "missing_address":
      return !hasAddress(row);
    case "missing_products_services":
      return !hasProductsServices(row);
    case "missing_summary":
      return !hasSummary(row);
    case "has_logo":
      return hasLogo(row);
    case "has_colors":
      return hasColors(row);
    case "has_business_name":
      return hasBusinessName(row);
    case "has_email":
      return hasEmail(row);
    case "has_phone":
      return hasPhone(row);
    case "has_social":
      return hasSocialLinks(row);
    case "has_products_services":
      return hasProductsServices(row);
    case "has_summary":
      return hasSummary(row);
    default:
      return true;
  }
}

/** Successful extraction rows are eligible for has/missing field filters. */
export function isEligibleForFieldFilters(
  review: BrandAuditRow | null | undefined,
  extractionStatus?: UrlInventoryExtractionStatus,
): boolean {
  if (extractionStatus === "not_run" || !review) return false;
  return review.status?.trim() === "success";
}

export function matchesFieldFilters(
  review: BrandAuditRow | null | undefined,
  fieldFilters: FieldFilterId[],
  options?: { extractionStatus?: UrlInventoryExtractionStatus },
): boolean {
  if (fieldFilters.length === 0) return true;
  if (!isEligibleForFieldFilters(review, options?.extractionStatus)) {
    return false;
  }
  const row = review!;
  for (const filterId of fieldFilters) {
    if (!matchesSingleFieldFilter(row, filterId)) return false;
  }
  return true;
}

export function missingFieldFilterForCoverageField(
  fieldId: ExtractionCoverageFieldId,
): FieldFilterId {
  const map: Record<ExtractionCoverageFieldId, FieldFilterId> = {
    business_name: "missing_business_name",
    logos: "missing_logo",
    colors: "missing_colors",
    emails: "missing_email",
    phones: "missing_phone",
    social: "missing_social",
    address: "missing_address",
    products_services: "missing_products_services",
    summary: "missing_summary",
  };
  return map[fieldId];
}
