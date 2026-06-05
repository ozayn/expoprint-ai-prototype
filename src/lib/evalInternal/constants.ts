import { join } from "node:path";

/** Only committed fixture read by /internal/eval — never runs/, results/, or private/. */
export const PUBLIC_SAMPLE_REVIEW_FILENAME = "public-sample-review.json";

export const PUBLIC_SAMPLE_REVIEW_PATH = join(
  process.cwd(),
  "data",
  "eval",
  PUBLIC_SAMPLE_REVIEW_FILENAME,
);
