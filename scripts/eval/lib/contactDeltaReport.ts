import { join } from "node:path";
import {
  hasAddress,
  hasEmail,
  hasPhone,
  hasSocialLinks,
} from "../../../src/lib/evalLocal/fieldCoverageHelpers.js";
import { extractionRunIdFromReviewQueueName } from "../../../src/lib/evalLocal/evalProcessedMeta.js";
import { normalizeStatusValue } from "../../../src/lib/evalLocal/normalizeEvalStatus.js";
import {
  canonicalSiteKeyForReviewRow,
} from "./reviewQueueProcessedIndex.js";
import type { ReviewQueueRow } from "./historicalReviewQueue.js";
import {
  EVAL_RESULTS_DIR,
} from "./paths.js";
import {
  findLatestBatchReviewQueueFilename,
  listCombinedReviewQueueFilenames,
  mergeBatchReviewQueuesInMemory,
  readCombinedReviewQueueCsv,
  readReviewQueueCsvFromResults,
  reviewQueueTimestampFromFilename,
} from "./combineReviewQueues.js";

export type ContactField = "email" | "phone" | "address" | "social";

export const CONTACT_FIELDS: ContactField[] = [
  "email",
  "phone",
  "address",
  "social",
];

export type BaselineSource =
  | "pre_rerun_combined"
  | "merged_batches_excluding_latest";

export type ContactFieldSnapshot = Record<ContactField, boolean>;

export type ContactDeltaExample = {
  url: string;
  domain: string;
  rerunStatus: string;
  baselineHadSuccess: boolean;
  newlyFilled: ContactField[];
  lost: ContactField[];
  before: ContactFieldSnapshot;
  after: ContactFieldSnapshot;
};

export type ContactDeltaReport = {
  latestBatchFile: string;
  latestBatchRunId: string;
  baselineSource: BaselineSource;
  baselineLabel: string;
  rowsRerun: number;
  rerunSuccesses: number;
  rerunFailures: number;
  previousSuccessfulRowsFound: number;
  emailNewlyFilled: number;
  phoneNewlyFilled: number;
  addressNewlyFilled: number;
  socialNewlyFilled: number;
  anyContactNewlyFilled: number;
  rowsUnchanged: number;
  rowsLostFields: number;
  rowResults: ContactDeltaExample[];
  examplesImproved: ContactDeltaExample[];
  examplesStillMissing: ContactDeltaExample[];
  examplesRegressed: ContactDeltaExample[];
};

function contactSnapshot(row: ReviewQueueRow): ContactFieldSnapshot {
  return {
    email: hasEmail(row),
    phone: hasPhone(row),
    address: hasAddress(row),
    social: hasSocialLinks(row),
  };
}

function rowUrl(row: ReviewQueueRow): string {
  return row.normalized_url?.trim() || row.domain?.trim() || row.canonical_domain?.trim() || "";
}

function isSuccessRow(row: ReviewQueueRow): boolean {
  return normalizeStatusValue(row.status) === "success";
}

export function compareContactFields(
  before: ReviewQueueRow,
  after: ReviewQueueRow,
): {
  beforeSnapshot: ContactFieldSnapshot;
  afterSnapshot: ContactFieldSnapshot;
  newlyFilled: ContactField[];
  lost: ContactField[];
  unchanged: boolean;
  stillMissingAny: boolean;
} {
  const beforeSnapshot = contactSnapshot(before);
  const afterSnapshot = contactSnapshot(after);
  const newlyFilled: ContactField[] = [];
  const lost: ContactField[] = [];

  for (const field of CONTACT_FIELDS) {
    if (!beforeSnapshot[field] && afterSnapshot[field]) {
      newlyFilled.push(field);
    }
    if (beforeSnapshot[field] && !afterSnapshot[field]) {
      lost.push(field);
    }
  }

  const unchanged = newlyFilled.length === 0 && lost.length === 0;
  const stillMissingAny = CONTACT_FIELDS.some((field) => !afterSnapshot[field]);

  return {
    beforeSnapshot,
    afterSnapshot,
    newlyFilled,
    lost,
    unchanged,
    stillMissingAny,
  };
}

export function buildBaselineReviewIndex(
  rows: ReviewQueueRow[],
): Map<string, ReviewQueueRow> {
  const index = new Map<string, ReviewQueueRow>();
  for (const row of rows) {
    const key = canonicalSiteKeyForReviewRow(row);
    if (!key) continue;
    index.set(key, row);
  }
  return index;
}

export function resolvePreRerunBaseline(
  resultsDir: string,
  latestBatchFilename: string,
): {
  rows: ReviewQueueRow[];
  source: BaselineSource;
  label: string;
} {
  const latestRunId =
    extractionRunIdFromReviewQueueName(latestBatchFilename) ??
    reviewQueueTimestampFromFilename(latestBatchFilename);

  const preRerunCombined = listCombinedReviewQueueFilenames(resultsDir).find(
    (name) => reviewQueueTimestampFromFilename(name) < latestRunId,
  );

  if (preRerunCombined) {
    const path = join(resultsDir, preRerunCombined);
    return {
      rows: readCombinedReviewQueueCsv(path),
      source: "pre_rerun_combined",
      label: path,
    };
  }

  const { rows } = mergeBatchReviewQueuesInMemory(resultsDir, {
    excludeFilenames: [latestBatchFilename],
  });

  return {
    rows,
    source: "merged_batches_excluding_latest",
    label: `merged batch queues excluding ${latestBatchFilename}`,
  };
}

export function buildContactDeltaReport(options: {
  latestBatchFilename: string;
  latestBatchRows: ReviewQueueRow[];
  baselineRows: ReviewQueueRow[];
  baselineSource: BaselineSource;
  baselineLabel: string;
  exampleLimit?: number;
}): ContactDeltaReport {
  const exampleLimit = options.exampleLimit ?? 10;
  const baselineIndex = buildBaselineReviewIndex(options.baselineRows);
  const latestBatchRunId =
    extractionRunIdFromReviewQueueName(options.latestBatchFilename) ??
    reviewQueueTimestampFromFilename(options.latestBatchFilename);

  let rerunSuccesses = 0;
  let rerunFailures = 0;
  let previousSuccessfulRowsFound = 0;
  let emailNewlyFilled = 0;
  let phoneNewlyFilled = 0;
  let addressNewlyFilled = 0;
  let socialNewlyFilled = 0;
  let anyContactNewlyFilled = 0;
  let rowsUnchanged = 0;
  let rowsLostFields = 0;

  const rowResults: ContactDeltaExample[] = [];
  const examplesImproved: ContactDeltaExample[] = [];
  const examplesStillMissing: ContactDeltaExample[] = [];
  const examplesRegressed: ContactDeltaExample[] = [];

  for (const rerunRow of options.latestBatchRows) {
    const siteKey = canonicalSiteKeyForReviewRow(rerunRow);
    const baselineRow = siteKey ? baselineIndex.get(siteKey) : undefined;
    const baselineHadSuccess = Boolean(baselineRow && isSuccessRow(baselineRow));

    if (isSuccessRow(rerunRow)) rerunSuccesses += 1;
    else rerunFailures += 1;

    if (baselineHadSuccess) previousSuccessfulRowsFound += 1;

    const beforeRow =
      baselineHadSuccess && baselineRow
        ? baselineRow
        : baselineRow ?? rerunRow;
    const afterRow = isSuccessRow(rerunRow) ? rerunRow : beforeRow;

    const delta = compareContactFields(beforeRow, afterRow);

    if (delta.newlyFilled.includes("email")) emailNewlyFilled += 1;
    if (delta.newlyFilled.includes("phone")) phoneNewlyFilled += 1;
    if (delta.newlyFilled.includes("address")) addressNewlyFilled += 1;
    if (delta.newlyFilled.includes("social")) socialNewlyFilled += 1;
    if (delta.newlyFilled.length > 0) anyContactNewlyFilled += 1;
    if (delta.unchanged) rowsUnchanged += 1;
    if (delta.lost.length > 0) rowsLostFields += 1;

    const example: ContactDeltaExample = {
      url: rowUrl(rerunRow),
      domain: rerunRow.canonical_domain?.trim() || rerunRow.domain?.trim() || "",
      rerunStatus: rerunRow.status?.trim() || "",
      baselineHadSuccess,
      newlyFilled: delta.newlyFilled,
      lost: delta.lost,
      before: delta.beforeSnapshot,
      after: delta.afterSnapshot,
    };
    rowResults.push(example);

    if (delta.newlyFilled.length > 0 && examplesImproved.length < exampleLimit) {
      examplesImproved.push(example);
    }
    if (
      delta.unchanged &&
      delta.stillMissingAny &&
      examplesStillMissing.length < exampleLimit
    ) {
      examplesStillMissing.push(example);
    }
    if (delta.lost.length > 0 && examplesRegressed.length < exampleLimit) {
      examplesRegressed.push(example);
    }
  }

  return {
    latestBatchFile: options.latestBatchFilename,
    latestBatchRunId,
    baselineSource: options.baselineSource,
    baselineLabel: options.baselineLabel,
    rowsRerun: options.latestBatchRows.length,
    rerunSuccesses,
    rerunFailures,
    previousSuccessfulRowsFound,
    emailNewlyFilled,
    phoneNewlyFilled,
    addressNewlyFilled,
    socialNewlyFilled,
    anyContactNewlyFilled,
    rowsUnchanged,
    rowsLostFields,
    rowResults,
    examplesImproved,
    examplesStillMissing,
    examplesRegressed,
  };
}

export function buildContactDeltaReportForLatestRun(
  resultsDir: string = EVAL_RESULTS_DIR,
  options?: { latestBatchFilename?: string; exampleLimit?: number },
): ContactDeltaReport {
  const latestBatchFilename =
    options?.latestBatchFilename ?? findLatestBatchReviewQueueFilename(resultsDir);
  const latestBatchRows = readReviewQueueCsvFromResults(
    resultsDir,
    latestBatchFilename,
  );
  const baseline = resolvePreRerunBaseline(resultsDir, latestBatchFilename);

  return buildContactDeltaReport({
    latestBatchFilename,
    latestBatchRows,
    baselineRows: baseline.rows,
    baselineSource: baseline.source,
    baselineLabel: baseline.label,
    exampleLimit: options?.exampleLimit,
  });
}

function formatContactSnapshot(snapshot: ContactFieldSnapshot): string {
  const parts = CONTACT_FIELDS.map((field) =>
    `${field}:${snapshot[field] ? "yes" : "no"}`,
  );
  return parts.join(", ");
}

function formatFieldList(fields: ContactField[]): string {
  return fields.length > 0 ? fields.join(", ") : "none";
}

export function printContactDeltaReport(report: ContactDeltaReport): void {
  console.log("Contact delta report");
  console.log(`  Latest batch:              ${report.latestBatchFile}`);
  console.log(`  Latest batch run id:       ${report.latestBatchRunId}`);
  console.log(`  Baseline source:           ${report.baselineSource}`);
  console.log(`  Baseline:                  ${report.baselineLabel}`);
  console.log("");
  console.log("Rerun batch");
  console.log(`  Rows rerun:                ${report.rowsRerun.toLocaleString()}`);
  console.log(`  Rerun successes:           ${report.rerunSuccesses.toLocaleString()}`);
  console.log(`  Rerun failures:            ${report.rerunFailures.toLocaleString()}`);
  console.log(
    `  Previous successful rows:  ${report.previousSuccessfulRowsFound.toLocaleString()}`,
  );
  console.log("");
  console.log("Contact field changes (vs baseline success when available)");
  console.log(
    `  Email newly filled:        ${report.emailNewlyFilled.toLocaleString()}`,
  );
  console.log(
    `  Phone newly filled:        ${report.phoneNewlyFilled.toLocaleString()}`,
  );
  console.log(
    `  Address newly filled:      ${report.addressNewlyFilled.toLocaleString()}`,
  );
  console.log(
    `  Social newly filled:       ${report.socialNewlyFilled.toLocaleString()}`,
  );
  console.log(
    `  Any contact newly filled:  ${report.anyContactNewlyFilled.toLocaleString()}`,
  );
  console.log(
    `  Rows unchanged:            ${report.rowsUnchanged.toLocaleString()}`,
  );
  console.log(
    `  Rows that lost fields:     ${report.rowsLostFields.toLocaleString()}`,
  );

  printExampleSection(
    "Examples — contact improved",
    report.examplesImproved,
    (example) =>
      `${example.url} (+${formatFieldList(example.newlyFilled)}; before ${formatContactSnapshot(example.before)}; after ${formatContactSnapshot(example.after)})`,
  );
  printExampleSection(
    "Examples — contact still missing",
    report.examplesStillMissing,
    (example) =>
      `${example.url} (status ${example.rerunStatus}; ${formatContactSnapshot(example.after)})`,
  );
  printExampleSection(
    "Examples — fields regressed",
    report.examplesRegressed,
    (example) =>
      `${example.url} (-${formatFieldList(example.lost)}; before ${formatContactSnapshot(example.before)}; after ${formatContactSnapshot(example.after)})`,
  );
}

function printExampleSection(
  title: string,
  examples: ContactDeltaExample[],
  formatLine: (example: ContactDeltaExample) => string,
): void {
  console.log("");
  console.log(title);
  if (examples.length === 0) {
    console.log("  (none)");
    return;
  }
  for (const example of examples) {
    console.log(`  - ${formatLine(example)}`);
  }
}
