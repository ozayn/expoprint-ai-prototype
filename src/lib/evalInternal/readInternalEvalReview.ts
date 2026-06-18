import { access, readFile } from "node:fs/promises";
import { normalizeBrandAuditRows } from "@/lib/evalLocal/brandAuditRow";
import type {
  InternalEvalDatasetPayload,
  InternalEvalUrlInventoryPayload,
  PublishedInternalEvalFile,
} from "@/lib/evalLocal/publishedInternalEvalTypes";
import {
  INTERNAL_EVAL_REVIEW_FILENAME,
  INTERNAL_EVAL_REVIEW_PATH,
  INTERNAL_EVAL_URL_INVENTORY_FILENAME,
  INTERNAL_EVAL_URL_INVENTORY_PATH,
  PUBLIC_SAMPLE_REVIEW_FILENAME,
  PUBLIC_SAMPLE_REVIEW_PATH,
} from "./constants";
import {
  parsePublishedUrlInventoryFile,
  publishedUrlInventoryRowsToUrlInventoryRows,
} from "./publishedUrlInventory";

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function parsePublishedReviewFile(
  raw: string,
  filename: string,
): PublishedInternalEvalFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid review JSON fixture: ${filename}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Review JSON must be an object: ${filename}`);
  }

  const file = parsed as Partial<PublishedInternalEvalFile>;
  if (!Array.isArray(file.rows)) {
    throw new Error(`Review JSON must include a rows array: ${filename}`);
  }

  return {
    description:
      file.description ??
      "Sanitized published review data for /internal/eval.",
    published_at: file.published_at ?? "",
    source_review_queue: file.source_review_queue ?? "",
    include_domains: file.include_domains ?? false,
    include_logo_urls: file.include_logo_urls ?? true,
    rows: normalizeBrandAuditRows(file.rows),
  };
}

async function readReviewJsonFile(path: string, filename: string): Promise<{
  file: PublishedInternalEvalFile;
  filename: string;
}> {
  const raw = await readFile(path, "utf8");
  const file = parsePublishedReviewFile(raw, filename);
  return { file, filename };
}

/**
 * Reads published sanitized eval data for /internal/eval.
 * Prefers data/eval/public/internal-eval-review.json, then public-sample-review.json.
 * Never reads data/eval/results, runs/, or data/private/.
 */
export async function readInternalEvalReview(): Promise<
  InternalEvalDatasetPayload["review"]
> {
  if (await pathExists(INTERNAL_EVAL_REVIEW_PATH)) {
    const { file, filename } = await readReviewJsonFile(
      INTERNAL_EVAL_REVIEW_PATH,
      INTERNAL_EVAL_REVIEW_FILENAME,
    );
    return {
      filename,
      rows: file.rows,
      source: "published",
      sourceLabel: "Published sanitized data",
      publishedAt: file.published_at || undefined,
      sourceReviewQueue: file.source_review_queue || undefined,
    };
  }

  const { file, filename } = await readReviewJsonFile(
    PUBLIC_SAMPLE_REVIEW_PATH,
    PUBLIC_SAMPLE_REVIEW_FILENAME,
  );
  return {
    filename,
    rows: file.rows,
    source: "sample",
    sourceLabel: "Sample data",
    publishedAt: file.published_at || undefined,
    sourceReviewQueue: file.source_review_queue || undefined,
  };
}

/**
 * Reads optional published URL inventory for /internal/eval.
 * Only reads data/eval/public/internal-eval-url-inventory.json when present.
 */
export async function readInternalEvalUrlInventory(): Promise<
  InternalEvalUrlInventoryPayload | null
> {
  if (!(await pathExists(INTERNAL_EVAL_URL_INVENTORY_PATH))) {
    return null;
  }

  const raw = await readFile(INTERNAL_EVAL_URL_INVENTORY_PATH, "utf8");
  const file = parsePublishedUrlInventoryFile(
    raw,
    INTERNAL_EVAL_URL_INVENTORY_FILENAME,
  );

  return {
    filename: INTERNAL_EVAL_URL_INVENTORY_FILENAME,
    rows: file.rows,
    publishedAt: file.published_at,
    sourceUrlCandidates: file.source_url_candidates,
    sourceReviewQueue: file.source_review_queue,
    includeDomains: file.include_domains,
    includeProjectContext: file.include_project_context,
    includeLogoUrls: file.include_logo_urls,
  };
}

export async function readInternalEvalDataset(): Promise<InternalEvalDatasetPayload> {
  const review = await readInternalEvalReview();
  const inventoryPayload = await readInternalEvalUrlInventory();

  return {
    review,
    urlInventory: inventoryPayload,
  };
}

/** Map published inventory JSON rows to viewer table rows. */
export function urlInventoryPayloadToViewerRows(
  payload: InternalEvalUrlInventoryPayload,
) {
  return publishedUrlInventoryRowsToUrlInventoryRows(
    payload.rows,
    payload.sourceReviewQueue,
  );
}
