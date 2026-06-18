import type { Metadata } from "next";
import Link from "next/link";
import { AddManualUrlsPanel } from "@/components/eval/AddManualUrlsPanel";
import { BrandAuditViewer } from "@/components/eval/BrandAuditViewer";
import { EvalInternalsPanel } from "@/components/eval/EvalInternalsPanel";
import {
  getEvalViewerPassword,
  isEvalViewerAuthenticated,
  isEvalViewerConfiguredInProduction,
} from "@/lib/evalInternal/auth";
import { mapPublishedUrlInventoryRows } from "@/lib/evalInternal/publishedUrlInventory";
import {
  readInternalEvalDataset,
  urlInventoryPayloadToViewerRows,
} from "@/lib/evalInternal/readInternalEvalReview";
import type { EvalViewerQueryParams } from "@/lib/evalLocal/evalViewerQuery";
import {
  EVAL_VIEWER_BASE_PATH,
  EVAL_VIEWER_DATA_SOURCE_LABEL_LOCAL,
  EVAL_VIEWER_DATA_SOURCE_LABEL_PUBLISHED,
  loadLocalEvalViewerDataset,
} from "@/lib/evalLocal/loadLocalEvalViewerDataset";
import { isEvalViewerEnabled } from "@/lib/evalLocal/isEvalViewerEnabled";
import { computeUrlInventoryStats } from "@/lib/evalLocal/urlInventoryJoin";
import { InternalEvalLogin } from "./InternalEvalLogin";
import { InternalEvalLogout } from "./InternalEvalLogout";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Historical brand audit — ExpoPrint",
  description: "Visual brand audit viewer for historical website extraction.",
  robots: { index: false, follow: false },
};

function NotConfigured() {
  return (
    <div className="min-h-full bg-white text-zinc-900">
      <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
        <p className="text-sm text-zinc-500">
          <Link href="/" className="hover:text-zinc-800">
            ← Back to editor
          </Link>
        </p>
        <h1 className="mt-8 text-xl font-semibold">Historical brand audit</h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-600">
          Evaluation viewer is not configured.
        </p>
      </div>
    </div>
  );
}

type PageProps = {
  searchParams: Promise<EvalViewerQueryParams>;
};

export default async function InternalEvalPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const localMode = isEvalViewerEnabled();

  if (!localMode && !isEvalViewerConfiguredInProduction()) {
    return <NotConfigured />;
  }

  if (!localMode) {
    const password = getEvalViewerPassword();
    const authed = await isEvalViewerAuthenticated();
    if (password && !authed) {
      return <InternalEvalLogin />;
    }
  }

  if (localMode) {
    const data = await loadLocalEvalViewerDataset(params);

    return (
      <BrandAuditViewer
        basePath={EVAL_VIEWER_BASE_PATH}
        searchParams={params}
        subtitle="Historical websites processed through ExpoPrint."
        dataSourceLabel={EVAL_VIEWER_DATA_SOURCE_LABEL_LOCAL}
        dataKind="local"
        publishHint={data.publishHint}
        reviewFilename={data.reviewData?.filename}
        batchReviewQueues={data.batchQueues}
        combinedReviewQueues={data.combinedQueues}
        rows={data.reviewRows}
        urlInventoryFilename={data.candidatesData?.filename}
        urlInventoryRows={data.urlInventory?.rows}
        urlInventoryRawRows={data.urlInventory?.rawRows}
        inventoryStats={data.urlInventory?.stats}
        emptyMessage={
          data.index.reviewQueues.length === 0
            ? "No review queue yet. Run npm run eval:review on an extraction JSONL or use Add URLs."
            : undefined
        }
        prependContent={
          <AddManualUrlsPanel basePath={EVAL_VIEWER_BASE_PATH} />
        }
      >
        <EvalInternalsPanel
          basePath={EVAL_VIEWER_BASE_PATH}
          index={data.index}
          summaryName={data.summaryName}
          reviewName={data.reviewName}
          scoreName={data.scoreName}
          urlCandidatesName={data.candidatesName}
          summaryData={data.summaryData}
          scoreData={data.scoreData}
          searchParams={params}
          showCliHints
        />
      </BrandAuditViewer>
    );
  }

  const password = getEvalViewerPassword();
  const dataset = await readInternalEvalDataset();
  const reviewData = dataset.review;
  const urlInventoryPayload = dataset.urlInventory;
  const urlInventoryRows = urlInventoryPayload
    ? urlInventoryPayloadToViewerRows(urlInventoryPayload)
    : undefined;
  const inventoryStats =
    urlInventoryPayload && urlInventoryRows
      ? computeUrlInventoryStats(
          urlInventoryRows,
          urlInventoryPayload.rows.length,
        )
      : undefined;

  return (
    <BrandAuditViewer
      basePath={EVAL_VIEWER_BASE_PATH}
      searchParams={params}
      subtitle="Historical websites processed through ExpoPrint."
      dataSourceLabel={EVAL_VIEWER_DATA_SOURCE_LABEL_PUBLISHED}
      publishedAt={
        reviewData.source === "published" ? reviewData.publishedAt : undefined
      }
      sourceReviewQueue={
        reviewData.source === "published"
          ? reviewData.sourceReviewQueue
          : undefined
      }
      sourceUrlCandidates={urlInventoryPayload?.sourceUrlCandidates}
      reviewRowCount={reviewData.rows.length}
      urlInventoryRowCount={urlInventoryRows?.length}
      dataKind={reviewData.source}
      headerAction={password ? <InternalEvalLogout /> : undefined}
      reviewFilename={reviewData.filename}
      rows={reviewData.rows}
      urlInventoryFilename={
        urlInventoryPayload ? urlInventoryPayload.filename : undefined
      }
      urlInventoryRows={urlInventoryRows}
      urlInventoryRawRows={
        urlInventoryPayload
          ? mapPublishedUrlInventoryRows(
              urlInventoryPayload.rows,
              urlInventoryPayload.sourceReviewQueue,
            )
          : undefined
      }
      inventoryStats={inventoryStats}
      emptyMessage="No published review rows in this dataset."
    />
  );
}
