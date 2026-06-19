#!/usr/bin/env node
import assert from "node:assert/strict";
import { runExtractionBatchForInputs } from "../../../src/lib/evalLocal/extractionBatch.js";
import type { UrlCandidateExtractionInput } from "../../../src/lib/evalLocal/extractionTypes.js";

function sampleInput(url: string): UrlCandidateExtractionInput {
  return {
    ds_id: "1",
    ds_number: "DS-1",
    project_title: "T",
    project_type: "",
    shop_code: "",
    source_column: "first_req_description",
    normalized_url: url,
    domain: "example.com",
    canonical_domain: "example.com",
    first_req_description: "",
    first_req_note: "",
  };
}

async function testProgressEventsForEachUrl(): Promise<void> {
  const events: string[] = [];
  const records = await runExtractionBatchForInputs(
    [sampleInput("https://a.com/"), sampleInput("https://b.com/")],
    {
      delayMs: 0,
      extractFn: async () => ({
        response: {
          ok: false,
          reason: "test",
          metadata: {
            source: "scraper_only",
            pagesInspected: 0,
            durationMs: 1,
            websiteFetch: { status: "failed", reason: "test" },
            claude: { attempted: false, model: "", status: "skipped" },
            warnings: [],
          },
        },
        durationMs: 5,
      }),
      onProgress: (event) => {
        events.push(`${event.phase}:${event.index}/${event.total}`);
      },
    },
  );

  assert.equal(records.length, 2);
  assert.deepEqual(events, [
    "start:1/2",
    "done:1/2",
    "start:2/2",
    "done:2/2",
  ]);
}

async function main(): Promise<void> {
  await testProgressEventsForEachUrl();
  console.log("extractionBatch.test.ts: all checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
