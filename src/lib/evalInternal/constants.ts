import { join } from "node:path";

/** Legacy sample fixture — fallback when no published file exists. */
export const PUBLIC_SAMPLE_REVIEW_FILENAME = "public-sample-review.json";

export const PUBLIC_SAMPLE_REVIEW_PATH = join(
  process.cwd(),
  "data",
  "eval",
  PUBLIC_SAMPLE_REVIEW_FILENAME,
);

/** Explicit publish output from `npm run eval:publish-internal`. */
export const INTERNAL_EVAL_REVIEW_FILENAME = "internal-eval-review.json";

export const INTERNAL_EVAL_PUBLIC_DIR = join(
  process.cwd(),
  "data",
  "eval",
  "public",
);

export const INTERNAL_EVAL_REVIEW_PATH = join(
  INTERNAL_EVAL_PUBLIC_DIR,
  INTERNAL_EVAL_REVIEW_FILENAME,
);

/** Optional published URL inventory for /internal/eval All URLs tab. */
export const INTERNAL_EVAL_URL_INVENTORY_FILENAME =
  "internal-eval-url-inventory.json";

export const INTERNAL_EVAL_URL_INVENTORY_PATH = join(
  INTERNAL_EVAL_PUBLIC_DIR,
  INTERNAL_EVAL_URL_INVENTORY_FILENAME,
);
