import { canonicalSiteDedupeKeyFromFields } from "../../../src/lib/evalLocal/evalCanonicalDedup.js";
import {
  hasColors,
  hasLogo,
} from "../../../src/lib/evalLocal/fieldCoverageHelpers.js";
import {
  compareUrlPriority,
  countSelectedByPathType,
  isRootUrl,
  urlForCandidateFields,
} from "../../../src/lib/evalLocal/evalUrlPriority.js";
import type { ReviewQueueRow } from "./historicalReviewQueue.js";
import type { ProcessedExtractionOutcome } from "./reviewQueueProcessedIndex.js";
import {
  canonicalDomainForRow,
  dedupeUrlCandidateRowsByNormalizedUrl,
  type UrlCandidateOutputRow,
} from "./urlCandidates.js";

export type SelectUrlCandidatesOptions = {
  allowDuplicateDomains: boolean;
  offset: number;
  limit: number;
  processedStatusIndex?: Map<string, ProcessedExtractionOutcome>;
  retryFailed?: boolean;
  reprocess?: boolean;
  /** Reprocess successful rows with logo but no colors only. */
  reprocessMissingColors?: boolean;
  /** Canonical site key → merged review row (for palette reprocess checks). */
  processedReviewIndex?: Map<string, ReviewQueueRow>;
  /** When true, sort eligible URLs by root/shallow/deep priority (default for extract-and-review). */
  prioritizeRootUrls?: boolean;
  /** Keep eligible inventory order; disables root URL prioritization. */
  preserveOrder?: boolean;
  /** Only select root/homepage URLs. */
  rootOnly?: boolean;
};

export type UrlCandidateSelectionSummary = {
  totalCandidates: number;
  alreadySuccessful: number;
  alreadyFailed: number;
  notRun: number;
  selectedForBatch: number;
  selectedRoot: number;
  selectedShallowPath: number;
  selectedDeepPath: number;
  skippedByRootOnly?: number;
  alreadySuccessfulWithColors?: number;
  successfulMissingColors?: number;
  selectedMissingColorReprocess?: number;
};

export type UrlCandidateSelectionResult = {
  selected: UrlCandidateOutputRow[];
  summary?: UrlCandidateSelectionSummary;
};

type EligibleEntry = {
  row: UrlCandidateOutputRow;
  inventoryIndex: number;
};

function domainDedupeKey(row: UrlCandidateOutputRow): string {
  return canonicalDomainForRow(row);
}

function candidateSiteKey(row: UrlCandidateOutputRow): string | null {
  return canonicalSiteDedupeKeyFromFields({
    canonical_domain: row.canonical_domain,
    domain: row.domain,
    normalized_url: row.normalized_url,
    raw_url: row.raw_url,
  });
}

function processedStatusForCandidate(
  row: UrlCandidateOutputRow,
  index: Map<string, ProcessedExtractionOutcome> | undefined,
): "success" | "failed" | "not_run" {
  if (!index || index.size === 0) return "not_run";
  const key = candidateSiteKey(row);
  if (!key) return "not_run";
  return index.get(key) ?? "not_run";
}

function isEligibleForBatch(
  status: "success" | "failed" | "not_run",
  options: SelectUrlCandidatesOptions,
  reviewRow?: ReviewQueueRow,
): boolean {
  if (options.reprocessMissingColors) {
    if (status === "not_run") return true;
    if (status === "failed") return options.retryFailed ?? false;
    if (status === "success") {
      if (!reviewRow) return false;
      return hasLogo(reviewRow) && !hasColors(reviewRow);
    }
    return false;
  }
  if (options.reprocess) return true;
  if (status === "not_run") return true;
  if (status === "failed" && options.retryFailed) return true;
  return false;
}

function isMissingColorReprocessSuccess(
  status: "success" | "failed" | "not_run",
  reviewRow: ReviewQueueRow | undefined,
): boolean {
  return (
    status === "success" &&
    reviewRow !== undefined &&
    hasLogo(reviewRow) &&
    !hasColors(reviewRow)
  );
}

function candidateUrl(row: UrlCandidateOutputRow): string {
  return urlForCandidateFields(row.normalized_url, row.raw_url);
}

function sortEligibleEntries(
  entries: EligibleEntry[],
  options: SelectUrlCandidatesOptions,
): EligibleEntry[] {
  if (options.preserveOrder) return entries;

  const prioritize = options.prioritizeRootUrls ?? false;
  if (!prioritize) return entries;

  return [...entries].sort((a, b) =>
    compareUrlPriority(
      candidateUrl(a.row),
      candidateUrl(b.row),
      a.inventoryIndex,
      b.inventoryIndex,
    ),
  );
}

function buildSummary(
  rows: UrlCandidateOutputRow[],
  selected: UrlCandidateOutputRow[],
  counts: {
    alreadySuccessful: number;
    alreadyFailed: number;
    notRun: number;
    alreadySuccessfulWithColors?: number;
    successfulMissingColors?: number;
    selectedMissingColorReprocess?: number;
  },
  skippedByRootOnly?: number,
): UrlCandidateSelectionSummary {
  const selectedUrls = selected.map(candidateUrl);
  const byType = countSelectedByPathType(selectedUrls);

  return {
    totalCandidates: rows.length,
    alreadySuccessful: counts.alreadySuccessful,
    alreadyFailed: counts.alreadyFailed,
    notRun: counts.notRun,
    selectedForBatch: selected.length,
    selectedRoot: byType.root,
    selectedShallowPath: byType.shallow,
    selectedDeepPath: byType.deep,
    ...(skippedByRootOnly !== undefined && skippedByRootOnly > 0
      ? { skippedByRootOnly }
      : {}),
    ...(counts.alreadySuccessfulWithColors !== undefined
      ? { alreadySuccessfulWithColors: counts.alreadySuccessfulWithColors }
      : {}),
    ...(counts.successfulMissingColors !== undefined
      ? { successfulMissingColors: counts.successfulMissingColors }
      : {}),
    ...(counts.selectedMissingColorReprocess !== undefined
      ? { selectedMissingColorReprocess: counts.selectedMissingColorReprocess }
      : {}),
  };
}

export function selectUrlCandidatesWithSummary(
  candidates: UrlCandidateOutputRow[],
  options: SelectUrlCandidatesOptions,
): UrlCandidateSelectionResult {
  const { rows: urlDeduped } = dedupeUrlCandidateRowsByNormalizedUrl(
    candidates,
    "Extraction batch",
  );

  let rows = urlDeduped;

  if (!options.allowDuplicateDomains) {
    const seen = new Set<string>();
    const deduped: UrlCandidateOutputRow[] = [];
    for (const row of rows) {
      const key = domainDedupeKey(row);
      if (!key) {
        deduped.push(row);
        continue;
      }
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(row);
    }
    rows = deduped;
  }

  const index = options.processedStatusIndex;
  const hasProcessedFilter = Boolean(index && index.size > 0);

  let alreadySuccessful = 0;
  let alreadyFailed = 0;
  let notRun = 0;
  let alreadySuccessfulWithColors = 0;
  let successfulMissingColors = 0;

  if (hasProcessedFilter) {
    for (const row of rows) {
      const status = processedStatusForCandidate(row, index);
      if (status === "success") {
        alreadySuccessful += 1;
        if (options.reprocessMissingColors) {
          const key = candidateSiteKey(row);
          const reviewRow = key
            ? options.processedReviewIndex?.get(key)
            : undefined;
          if (reviewRow && hasColors(reviewRow)) {
            alreadySuccessfulWithColors += 1;
          } else if (reviewRow && hasLogo(reviewRow) && !hasColors(reviewRow)) {
            successfulMissingColors += 1;
          }
        }
      } else if (status === "failed") alreadyFailed += 1;
      else notRun += 1;
    }
  }

  const eligibleEntries: EligibleEntry[] = [];
  let selectedMissingColorReprocess = 0;
  for (let inventoryIndex = 0; inventoryIndex < rows.length; inventoryIndex += 1) {
    const row = rows[inventoryIndex];
    const status = hasProcessedFilter
      ? processedStatusForCandidate(row, index)
      : "not_run";
    const siteKey = candidateSiteKey(row);
    const reviewRow = siteKey
      ? options.processedReviewIndex?.get(siteKey)
      : undefined;
    if (
      hasProcessedFilter &&
      !isEligibleForBatch(status, options, reviewRow)
    ) {
      continue;
    }
    eligibleEntries.push({ row, inventoryIndex });
  }

  const sortedEligible = sortEligibleEntries(eligibleEntries, options);

  let rootFiltered = sortedEligible;
  let skippedByRootOnly = 0;
  if (options.rootOnly) {
    const onlyRoot = sortedEligible.filter((entry) =>
      isRootUrl(candidateUrl(entry.row)),
    );
    skippedByRootOnly = sortedEligible.length - onlyRoot.length;
    rootFiltered = onlyRoot;
  }

  const { offset, limit } = options;
  const selected =
    limit <= 0
      ? []
      : rootFiltered.slice(offset, offset + limit).map((entry) => entry.row);

  if (options.reprocessMissingColors && hasProcessedFilter) {
    for (const row of selected) {
      const status = processedStatusForCandidate(row, index);
      const siteKey = candidateSiteKey(row);
      const reviewRow = siteKey
        ? options.processedReviewIndex?.get(siteKey)
        : undefined;
      if (isMissingColorReprocessSuccess(status, reviewRow)) {
        selectedMissingColorReprocess += 1;
      }
    }
  }

  const shouldSummarize =
    hasProcessedFilter ||
    options.prioritizeRootUrls ||
    options.rootOnly ||
    options.preserveOrder ||
    options.reprocessMissingColors;

  const summary = shouldSummarize
    ? buildSummary(rows, selected, {
        alreadySuccessful,
        alreadyFailed,
        notRun,
        ...(options.reprocessMissingColors
          ? {
              alreadySuccessfulWithColors,
              successfulMissingColors,
              selectedMissingColorReprocess,
            }
          : {}),
      }, options.rootOnly ? skippedByRootOnly : undefined)
    : undefined;

  return { selected, summary };
}

export function selectUrlCandidatesForExtraction(
  candidates: UrlCandidateOutputRow[],
  options: SelectUrlCandidatesOptions,
): UrlCandidateOutputRow[] {
  return selectUrlCandidatesWithSummary(candidates, options).selected;
}

export function printUrlCandidateSelectionSummary(
  summary: UrlCandidateSelectionSummary,
): void {
  console.log("URL candidate selection");
  console.log(`  Total candidates:      ${summary.totalCandidates.toLocaleString()}`);
  console.log(`  Already successful:    ${summary.alreadySuccessful.toLocaleString()}`);
  console.log(`  Already failed:        ${summary.alreadyFailed.toLocaleString()}`);
  console.log(`  Not run:               ${summary.notRun.toLocaleString()}`);
  console.log(`  Selected for batch:    ${summary.selectedForBatch.toLocaleString()}`);
  console.log(`  Selected root URLs:    ${summary.selectedRoot.toLocaleString()}`);
  console.log(
    `  Selected shallow path: ${summary.selectedShallowPath.toLocaleString()}`,
  );
  console.log(`  Selected deep path:    ${summary.selectedDeepPath.toLocaleString()}`);
  if (summary.skippedByRootOnly !== undefined) {
    console.log(
      `  Skipped (--root-only): ${summary.skippedByRootOnly.toLocaleString()}`,
    );
  }
  if (summary.alreadySuccessfulWithColors !== undefined) {
    console.log(
      `  Successful w/ colors:  ${summary.alreadySuccessfulWithColors.toLocaleString()} (skipped)`,
    );
  }
  if (summary.successfulMissingColors !== undefined) {
    console.log(
      `  Successful missing colors:${summary.successfulMissingColors.toLocaleString()} (eligible)`,
    );
  }
  if (summary.selectedMissingColorReprocess !== undefined) {
    console.log(
      `  Selected missing-color:${summary.selectedMissingColorReprocess.toLocaleString()} reprocess rows`,
    );
  }
}

export { classifyUrlPathType, URL_PATH_TYPE_LABELS } from "../../../src/lib/evalLocal/evalUrlPriority.js";
