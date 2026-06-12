import { access, readFile } from "node:fs/promises";
import { normalizeBrandAuditRows } from "@/lib/evalLocal/brandAuditRow";
import type {
  InternalEvalReviewPayload,
  PublishedInternalEvalFile,
} from "@/lib/evalLocal/publishedInternalEvalTypes";
import {
  INTERNAL_EVAL_REVIEW_FILENAME,
  INTERNAL_EVAL_REVIEW_PATH,
  PUBLIC_SAMPLE_REVIEW_FILENAME,
  PUBLIC_SAMPLE_REVIEW_PATH,
} from "./constants";

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function parsePublishedFile(
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
  const file = parsePublishedFile(raw, filename);
  return { file, filename };
}

/**
 * Reads published sanitized eval data for /internal/eval.
 * Prefers data/eval/public/internal-eval-review.json, then public-sample-review.json.
 * Never reads data/eval/results, runs/, or data/private/.
 */
export async function readInternalEvalReview(): Promise<InternalEvalReviewPayload> {
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
