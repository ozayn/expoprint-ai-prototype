import { colorEntriesForRow } from "./brandExtractionParse";
import type { BrandAuditRow } from "./brandAuditRow";
import { addressesForRow } from "./contactExtractionParse";
import { hasOfferingsForRow } from "./offeringsExtractionParse";
import {
  hasColors,
  hasEmail,
  hasLogo,
  hasPhone,
  hasSocialLinks,
  hasSummary,
} from "./fieldCoverageHelpers";

const SOCIAL_HOST_RE =
  /facebook\.com|instagram\.com|twitter\.com|x\.com|linkedin\.com|youtube\.com|tiktok\.com/i;
const ADDRESS_NOISE_RE =
  /social handle|uploaded assets|graphic provided/i;
const STREET_RE =
  /\b(street|st\.?|avenue|ave\.?|road|rd\.?|blvd|boulevard|suite|ste\.?|drive|dr\.?|lane|ln\.?|way|parkway|pkwy)\b/i;
const STATE_ZIP_RE = /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/;

/**
 * For merge decisions only — filters scraped noise and social URLs miscast as addresses.
 */
export function isPlausiblePhysicalAddress(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (SOCIAL_HOST_RE.test(lower)) return false;
  if (ADDRESS_NOISE_RE.test(lower)) return false;
  if (lower.startsWith("http://") || lower.startsWith("https://")) return false;
  if (/\d{2,}/.test(trimmed)) return true;
  if (STREET_RE.test(trimmed)) return true;
  if (STATE_ZIP_RE.test(trimmed)) return true;
  return trimmed.length >= 14;
}

export function hasPlausibleAddressForMerge(row: BrandAuditRow): boolean {
  return addressesForRow(row).some((address) =>
    isPlausiblePhysicalAddress(address),
  );
}

export function contactCompletenessForMerge(row: BrandAuditRow): number {
  let score = 0;
  if (hasEmail(row)) score += 1;
  if (hasPhone(row)) score += 1;
  if (hasPlausibleAddressForMerge(row)) score += 1;
  if (hasSocialLinks(row)) score += 1;
  return score;
}

function parseOverallScore(row: BrandAuditRow): number | null {
  const raw = row.overall_score?.trim();
  if (!raw) return null;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * True when a newer success row improves logo/colors/offerings/summary/score enough
 * to justify accepting fewer contact fields than the older success row.
 */
export function hasMeaningfulExtractionGain(
  older: BrandAuditRow,
  newer: BrandAuditRow,
): boolean {
  if (!hasLogo(older) && hasLogo(newer)) return true;
  if (!hasColors(older) && hasColors(newer)) return true;

  const olderColorCount = colorEntriesForRow(older).length;
  const newerColorCount = colorEntriesForRow(newer).length;
  if (olderColorCount === 0 && newerColorCount > 0) return true;
  if (newerColorCount >= olderColorCount + 3) return true;

  if (!hasOfferingsForRow(older) && hasOfferingsForRow(newer)) return true;
  if (!hasSummary(older) && hasSummary(newer)) return true;

  if (!older.palette_source?.trim() && newer.palette_source?.trim()) return true;

  const olderOverall = parseOverallScore(older);
  const newerOverall = parseOverallScore(newer);
  if (
    olderOverall !== null &&
    newerOverall !== null &&
    newerOverall - olderOverall >= 1
  ) {
    return true;
  }

  return false;
}

export function shouldPreserveRicherContact(
  older: BrandAuditRow,
  newer: BrandAuditRow,
): boolean {
  const contactOlder = contactCompletenessForMerge(older);
  const contactNewer = contactCompletenessForMerge(newer);
  return (
    contactOlder > contactNewer && !hasMeaningfulExtractionGain(older, newer)
  );
}

export function contactFieldsLostInMerge(
  older: BrandAuditRow,
  newer: BrandAuditRow,
): string[] {
  const lost: string[] = [];
  if (hasEmail(older) && !hasEmail(newer)) lost.push("email");
  if (hasPhone(older) && !hasPhone(newer)) lost.push("phone");
  if (hasPlausibleAddressForMerge(older) && !hasPlausibleAddressForMerge(newer)) {
    lost.push("address");
  }
  if (hasSocialLinks(older) && !hasSocialLinks(newer)) lost.push("social");
  return lost;
}

export function contactFieldsGainedInMerge(
  older: BrandAuditRow,
  newer: BrandAuditRow,
): string[] {
  const gained: string[] = [];
  if (!hasEmail(older) && hasEmail(newer)) gained.push("email");
  if (!hasPhone(older) && hasPhone(newer)) gained.push("phone");
  if (!hasPlausibleAddressForMerge(older) && hasPlausibleAddressForMerge(newer)) {
    gained.push("address");
  }
  if (!hasSocialLinks(older) && hasSocialLinks(newer)) gained.push("social");
  return gained;
}
