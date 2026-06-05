import { readExtractionSummaryFromDir } from "@/lib/evalLocal/readExtractionSummary";
import { readReviewQueueFromDir } from "@/lib/evalLocal/readReviewQueue";
import {
  INTERNAL_SAMPLE_DIR,
  isSafeInternalReviewQueueFilename,
  isSafeInternalSummaryFilename,
} from "./constants";

export async function readInternalExtractionSummary(filename: string) {
  return readExtractionSummaryFromDir(
    INTERNAL_SAMPLE_DIR,
    filename,
    isSafeInternalSummaryFilename,
  );
}

export async function readInternalReviewQueue(filename: string) {
  return readReviewQueueFromDir(
    INTERNAL_SAMPLE_DIR,
    filename,
    isSafeInternalReviewQueueFilename,
  );
}
