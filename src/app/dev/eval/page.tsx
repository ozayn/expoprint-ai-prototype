import type { Metadata } from "next";
import Link from "next/link";
import { EvalViewer } from "@/components/eval/EvalViewer";
import { isEvalViewerEnabled } from "@/lib/evalLocal/isEvalViewerEnabled";
import {
  listLocalEvalFiles,
  pickReviewQueueFilename,
  pickScoreSummaryFilename,
  pickSummaryFilename,
} from "@/lib/evalLocal/listEvalFiles";
import { readExtractionSummaryCsv } from "@/lib/evalLocal/readExtractionSummary";
import { readReviewQueueCsv } from "@/lib/evalLocal/readReviewQueue";
import { readScoreSummaryCsv } from "@/lib/evalLocal/readScoreSummary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Historical evaluation (local) — ExpoPrint",
  description: "Read-only viewer for local historical evaluation outputs.",
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
        <h1 className="mt-6 text-xl font-semibold">Historical evaluation viewer</h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-600">
          Evaluation viewer is available only in local development.
        </p>
      </div>
    </div>
  );
}

type PageProps = {
  searchParams: Promise<{ summary?: string; review?: string; score?: string }>;
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

  return (
    <EvalViewer
      basePath="/dev/eval"
      subtitle="Local review of historical extraction runs."
      safetyNote="Local-only · partner data stays on this machine"
      index={index}
      summaryName={summaryName}
      reviewName={reviewName}
      scoreName={scoreName}
      summaryData={summaryData}
      reviewData={reviewData}
      scoreData={scoreData}
      searchParams={params}
      showCliHints
    />
  );
}
