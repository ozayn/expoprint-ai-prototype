import { hasFlag } from "./cliArgs.js";
import type { ReviewQueueRow } from "./historicalReviewQueue.js";
import {
  hasAddress,
  hasEmail,
  hasPhone,
  hasSocialLinks,
} from "../../../src/lib/evalLocal/fieldCoverageHelpers.js";

export type MissingContactField = "email" | "phone" | "address" | "social";

export type MissingContactFilter = {
  fields: MissingContactField[];
};

export function parseMissingContactFilter(argv: string[]): MissingContactFilter | null {
  const email = hasFlag("--missing-email", argv);
  const phone = hasFlag("--missing-phone", argv);
  const address = hasFlag("--missing-address", argv);
  const social = hasFlag("--missing-social", argv);
  const contact = hasFlag("--missing-contact", argv);

  if (!contact && !email && !phone && !address && !social) {
    return null;
  }

  const fields: MissingContactField[] = [];
  if (email) fields.push("email");
  if (phone) fields.push("phone");
  if (address) fields.push("address");
  if (social) fields.push("social");

  if (fields.length === 0) {
    return { fields: ["email", "phone", "address", "social"] };
  }
  return { fields };
}

export function missingContactFilterLabel(filter: MissingContactFilter): string {
  if (filter.fields.length === 4) return "any contact field";
  return filter.fields.join(", ");
}

export function reviewRowMissingContactField(
  row: ReviewQueueRow,
  field: MissingContactField,
): boolean {
  switch (field) {
    case "email":
      return !hasEmail(row);
    case "phone":
      return !hasPhone(row);
    case "address":
      return !hasAddress(row);
    case "social":
      return !hasSocialLinks(row);
  }
}

export function reviewRowMatchesMissingContactFilter(
  row: ReviewQueueRow,
  filter: MissingContactFilter,
): boolean {
  return filter.fields.some((field) => reviewRowMissingContactField(row, field));
}

export function countMissingContactOnSuccessfulRows(
  rows: ReviewQueueRow[],
): Record<MissingContactField | "any", number> {
  let any = 0;
  const perField: Record<MissingContactField, number> = {
    email: 0,
    phone: 0,
    address: 0,
    social: 0,
  };

  for (const row of rows) {
    if (row.status?.trim() !== "success") continue;
    const missingEmail = !hasEmail(row);
    const missingPhone = !hasPhone(row);
    const missingAddress = !hasAddress(row);
    const missingSocial = !hasSocialLinks(row);
    if (missingEmail) perField.email += 1;
    if (missingPhone) perField.phone += 1;
    if (missingAddress) perField.address += 1;
    if (missingSocial) perField.social += 1;
    if (missingEmail || missingPhone || missingAddress || missingSocial) {
      any += 1;
    }
  }

  return { ...perField, any };
}
