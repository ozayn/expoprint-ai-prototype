import { canonicalSiteDedupeKeyFromFields } from "../../../src/lib/evalLocal/evalCanonicalDedup.js";
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
};

export type UrlCandidateSelectionSummary = {
  totalCandidates: number;
  alreadySuccessful: number;
  alreadyFailed: number;
  notRun: number;
  selectedForBatch: number;
};

export type UrlCandidateSelectionResult = {
  selected: UrlCandidateOutputRow[];
  summary?: UrlCandidateSelectionSummary;
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
): boolean {
  if (options.reprocess) return true;
  if (status === "not_run") return true;
  if (status === "failed" && options.retryFailed) return true;
  return false;
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

  if (hasProcessedFilter) {
    for (const row of rows) {
      const status = processedStatusForCandidate(row, index);
      if (status === "success") alreadySuccessful += 1;
      else if (status === "failed") alreadyFailed += 1;
      else notRun += 1;
    }
  }

  const eligible = hasProcessedFilter
    ? rows.filter((row) =>
        isEligibleForBatch(processedStatusForCandidate(row, index), options),
      )
    : rows;

  const { offset, limit } = options;
  const selected =
    limit <= 0 ? [] : eligible.slice(offset, offset + limit);

  const summary: UrlCandidateSelectionSummary | undefined = hasProcessedFilter
    ? {
        totalCandidates: rows.length,
        alreadySuccessful,
        alreadyFailed,
        notRun,
        selectedForBatch: selected.length,
      }
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
}
