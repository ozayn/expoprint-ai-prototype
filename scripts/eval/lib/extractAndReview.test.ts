#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  devEvalViewerUrl,
  shouldPublishAfterExtractAndReview,
} from "./extractAndReview.js";

assert.equal(
  shouldPublishAfterExtractAndReview({ combine: true }),
  true,
);
assert.equal(
  shouldPublishAfterExtractAndReview({ combine: true, noPublish: true }),
  false,
);
assert.equal(
  shouldPublishAfterExtractAndReview({ publish: true }),
  true,
);
assert.equal(
  shouldPublishAfterExtractAndReview({ combine: false }),
  false,
);
assert.equal(
  shouldPublishAfterExtractAndReview({
    combine: true,
    publish: true,
    noPublish: true,
  }),
  false,
);
assert.equal(
  devEvalViewerUrl("combined"),
  "http://localhost:3000/internal/eval?review=combined&view=inventory&sort=recent",
);

console.log("extractAndReview.test.ts: all checks passed");
