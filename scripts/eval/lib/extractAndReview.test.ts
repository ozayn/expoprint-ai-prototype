#!/usr/bin/env node
import assert from "node:assert/strict";
import { shouldPublishAfterExtractAndReview } from "./extractAndReview.js";

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

console.log("extractAndReview.test.ts: all checks passed");
