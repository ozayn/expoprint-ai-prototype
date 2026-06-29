import type { BrandAuditRow } from "../../../src/lib/evalLocal/brandAuditRow.js";

export type DsNumberAuditStats = {
  total: number;
  withDsNumber: number;
  missingDsNumber: number;
};

export function auditDsNumberCoverage(
  rows: Pick<BrandAuditRow, "ds_number">[],
): DsNumberAuditStats {
  const total = rows.length;
  const withDsNumber = rows.filter((row) => row.ds_number?.trim()).length;
  return {
    total,
    withDsNumber,
    missingDsNumber: total - withDsNumber,
  };
}

export function formatDsNumberAuditLabel(sourceLabel: string): string {
  return `ds_number coverage (${sourceLabel})`;
}

export function printDsNumberAudit(
  stats: DsNumberAuditStats,
  sourceLabel: string,
): void {
  console.log(formatDsNumberAuditLabel(sourceLabel));
  console.log(`  Total rows:           ${stats.total.toLocaleString()}`);
  console.log(`  Rows with ds_number:  ${stats.withDsNumber.toLocaleString()}`);
  console.log(`  Rows missing ds_number: ${stats.missingDsNumber.toLocaleString()}`);
}
