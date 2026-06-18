import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import {
  backfillPaletteMetadataOnRows,
  type BackfillPaletteMetadataSummary,
} from "../../../src/lib/evalLocal/backfillPaletteMetadata.js";
import { normalizeBrandAuditRow } from "../../../src/lib/evalLocal/brandAuditRow.js";
import type { PublishedInternalEvalFile } from "../../../src/lib/evalLocal/publishedInternalEvalTypes.js";
import type { ReviewQueueRow } from "../../../src/lib/evalLocal/reviewQueueTypes.js";
import {
  combinedReviewQueueToCsv,
  COMBINED_REVIEW_QUEUE_COLUMNS,
  isBatchReviewQueueFilename,
  isCombinedReviewQueueFilename,
  type CombinedReviewQueueRow,
} from "./combineReviewQueues.js";
import {
  REVIEW_QUEUE_COLUMNS,
  reviewQueueToCsv,
} from "./historicalReviewQueue.js";
import { csvRowsToObjects, parseCsv } from "./parseCsv.js";
import {
  printPublishInternalEvalSummary,
  publishReviewQueueCsvToInternalEval,
  type PublishInternalEvalResult,
} from "./publishInternalEvalLib.js";

export type BackfillInputKind = "batch_review" | "combined_review" | "published_json";

export type BackfillPaletteMetadataOptions = {
  dryRun?: boolean;
  publishAfterCombined?: boolean;
  includeDomains?: boolean;
  includeLogoUrls?: boolean;
};

export type BackfillPaletteMetadataResult = {
  inputPath: string;
  inputKind: BackfillInputKind;
  dryRun: boolean;
  summary: BackfillPaletteMetadataSummary;
  outputPaths: string[];
  publish?: PublishInternalEvalResult;
};

function detectBackfillInputKind(filePath: string): BackfillInputKind {
  const name = basename(filePath);
  if (name.toLowerCase().endsWith(".json")) return "published_json";
  if (isCombinedReviewQueueFilename(name)) return "combined_review";
  if (isBatchReviewQueueFilename(name)) return "batch_review";
  throw new Error(
    `Unsupported input file: ${name}. Use review_queue_*.csv, review_queue_combined_*.csv, or internal-eval-review.json`,
  );
}

function readReviewCsvRows(
  filePath: string,
  columns: readonly string[],
): ReviewQueueRow[] {
  const text = readFileSync(filePath, "utf8");
  const { records } = csvRowsToObjects(parseCsv(text));
  return records.map((record) => {
    const row = {} as ReviewQueueRow;
    for (const col of columns) {
      row[col as keyof ReviewQueueRow] = record[col] ?? "";
    }
    return row;
  });
}

function readPublishedJsonRows(filePath: string): {
  file: PublishedInternalEvalFile;
  rows: ReviewQueueRow[];
} {
  const raw = readFileSync(filePath, "utf8");
  const file = JSON.parse(raw) as PublishedInternalEvalFile;
  const rows = (file.rows ?? [])
    .map(normalizeBrandAuditRow)
    .filter((row): row is ReviewQueueRow => row !== null);
  return { file, rows };
}

export function printBackfillPaletteSummary(
  result: BackfillPaletteMetadataResult,
): void {
  const { summary, dryRun } = result;
  console.log(`Palette metadata backfill: ${result.inputPath}`);
  console.log(`  Input kind:           ${result.inputKind}`);
  console.log(`  Dry run:              ${dryRun ? "yes" : "no"}`);
  console.log(`  Rows updated:         ${summary.rowsUpdated}`);
  console.log(`  Logo inferred:        ${summary.logoInferred}`);
  console.log(`  Extraction inferred:  ${summary.extractionInferred}`);

  if (summary.changes.length > 0) {
    console.log("  Changes:");
    for (const change of summary.changes) {
      console.log(
        `    ${change.domain} → ${change.palette_source} / ${change.palette_confidence} (${change.reason})`,
      );
    }
  }

  if (!dryRun && result.outputPaths.length > 0) {
    console.log("  Output:");
    for (const path of result.outputPaths) {
      console.log(`    ${path}`);
    }
  }

  if (result.publish) {
    console.log("");
    printPublishInternalEvalSummary(result.publish);
  }
}

export function backfillPaletteMetadataFile(
  inputPath: string,
  options: BackfillPaletteMetadataOptions = {},
): BackfillPaletteMetadataResult {
  const dryRun = options.dryRun ?? false;
  const inputKind = detectBackfillInputKind(inputPath);
  const outputPaths: string[] = [];
  let publish: PublishInternalEvalResult | undefined;

  if (inputKind === "published_json") {
    const { file, rows } = readPublishedJsonRows(inputPath);
    const { rows: backfilled, summary } = backfillPaletteMetadataOnRows(rows);

    if (!dryRun && summary.rowsUpdated > 0) {
      const nextFile: PublishedInternalEvalFile = {
        ...file,
        published_at: new Date().toISOString(),
        rows: backfilled,
      };
      writeFileSync(inputPath, JSON.stringify(nextFile, null, 2) + "\n", "utf8");
      outputPaths.push(inputPath);
    }

    return {
      inputPath,
      inputKind,
      dryRun,
      summary,
      outputPaths,
    };
  }

  const columns =
    inputKind === "combined_review"
      ? COMBINED_REVIEW_QUEUE_COLUMNS
      : REVIEW_QUEUE_COLUMNS;
  const rows = readReviewCsvRows(inputPath, columns);
  const { rows: backfilled, summary } = backfillPaletteMetadataOnRows(rows);

  if (!dryRun && summary.rowsUpdated > 0) {
    if (inputKind === "combined_review") {
      const combinedRows = backfilled as CombinedReviewQueueRow[];
      writeFileSync(inputPath, combinedReviewQueueToCsv(combinedRows), "utf8");
      outputPaths.push(inputPath);

      const shouldPublish = options.publishAfterCombined ?? true;
      if (shouldPublish) {
        publish = publishReviewQueueCsvToInternalEval(inputPath, {
          includeDomains: options.includeDomains ?? true,
          includeLogoUrls: options.includeLogoUrls ?? true,
        });
        outputPaths.push(publish.outputPath);
      }
    } else {
      writeFileSync(inputPath, reviewQueueToCsv(backfilled), "utf8");
      outputPaths.push(inputPath);
    }
  }

  return {
    inputPath,
    inputKind,
    dryRun,
    summary,
    outputPaths,
    publish,
  };
}
