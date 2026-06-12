import type { Metadata } from "next";
import Link from "next/link";
import { AddManualUrlsPanel } from "@/components/eval/AddManualUrlsPanel";
import { BrandAuditViewer } from "@/components/eval/BrandAuditViewer";
import { EvalInternalsPanel } from "@/components/eval/EvalInternalsPanel";
import { isEvalViewerEnabled } from "@/lib/evalLocal/isEvalViewerEnabled";
import {
  listLocalEvalFiles,
  pickReviewQueueFilename,
  pickScoreSummaryFilename,
  pickSummaryFilename,
  pickUrlCandidatesFilename,
} from "@/lib/evalLocal/listEvalFiles";
import { readExtractionSummaryCsv } from "@/lib/evalLocal/readExtractionSummary";
import { readReviewQueueCsv } from "@/lib/evalLocal/readReviewQueue";
import { readScoreSummaryCsv } from "@/lib/evalLocal/readScoreSummary";
import { readUrlCandidatesCsv } from "@/lib/evalLocal/readUrlCandidates";
import { resolveUrlCandidatesParam } from "@/lib/evalLocal/evalViewerQuery";
import { buildUrlInventory } from "@/lib/evalLocal/urlInventoryJoin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Historical brand audit (local) — ExpoPrint",
  description: "Local visual brand audit for historical website extraction.",
  robots: { index: false, follow: false },
};

function ProductionBlocked() {
  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="text-sm text-zinc-500">
          <Link href="/" className="font-medium text-zinc-700 underline-offset-4 hover:underline">
            ← Back to editor
          </Link>
        </p>
        <h1 className="mt-6 text-xl font-semibold">Historical brand audit</h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-600">
          Evaluation viewer is available only in local development.
        </p>
      </div>
    </div>
  );
}

type PageProps = {
  searchParams: Promise<{
    summary?: string;
    review?: string;
    score?: string;
    urls?: string;
    candidates?: string;
    view?: string;
  }>;
};

export default async function DevEvalPage({ searchParams }: PageProps) {
  if (!isEvalViewerEnabled()) {
    return <ProductionBlocked />;
  }

  const params = await searchParams;
  const index = await listLocalEvalFiles();
  const summaryName = pickSummaryFilename(
    index.extractionSummaries,
    params.summary,
  );
  const reviewName = pickReviewQueueFilename(index.reviewQueues, params.review);
  const candidatesName = pickUrlCandidatesFilename(
    index.urlCandidates,
    resolveUrlCandidatesParam(params),
  );
  const scoreName = pickScoreSummaryFilename(
    index.scoreSummaries,
    params.score,
    reviewName,
  );

  const summaryData = summaryName
    ? await readExtractionSummaryCsv(summaryName)
    : null;
  const reviewData = reviewName ? await readReviewQueueCsv(reviewName) : null;
  const scoreData = scoreName ? await readScoreSummaryCsv(scoreName) : null;
  const candidatesData = candidatesName
    ? await readUrlCandidatesCsv(candidatesName)
    : null;

  const reviewRows = reviewData?.rows ?? [];
  const urlInventory = candidatesData
    ? buildUrlInventory(candidatesData.rows, reviewRows)
    : null;

  const publishHint = reviewName
    ? `npm run eval:publish-internal -- data/eval/results/${reviewName} --include-domains`
    : undefined;

  return (
    <BrandAuditViewer
      basePath="/dev/eval"
      searchParams={params}
      subtitle="Historical websites processed through ExpoPrint."
      safetyNote="Local-only · partner data stays on this machine"
      dataKind="local"
      publishHint={publishHint}
      reviewFilename={reviewData?.filename}
      rows={reviewRows}
      urlInventoryFilename={candidatesData?.filename}
      urlInventoryRows={urlInventory?.rows}
      inventoryStats={urlInventory?.stats}
      emptyMessage={
        index.reviewQueues.length === 0
          ? "No review queue yet. Run npm run eval:review on an extraction JSONL or use Add URLs."
          : undefined
      }
      prependContent={<AddManualUrlsPanel basePath="/dev/eval" />}
    >
      <EvalInternalsPanel
        basePath="/dev/eval"
        index={index}
        summaryName={summaryName}
        reviewName={reviewName}
        scoreName={scoreName}
        urlCandidatesName={candidatesName}
        summaryData={summaryData}
        scoreData={scoreData}
        searchParams={params}
        showCliHints
      />
    </BrandAuditViewer>
  );
}
