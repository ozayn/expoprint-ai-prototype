import type { Metadata } from "next";
import Link from "next/link";
import { InternalEvalLogin } from "./InternalEvalLogin";
import { EvalViewer } from "@/components/eval/EvalViewer";
import {
  getInternalEvalPassword,
  isInternalEvalAuthenticated,
} from "@/lib/evalInternal/auth";
import { listInternalEvalFiles } from "@/lib/evalInternal/listInternalEvalFiles";
import {
  readInternalExtractionSummary,
  readInternalReviewQueue,
} from "@/lib/evalInternal/readInternalEvalData";
import {
  pickReviewQueueFilename,
  pickSummaryFilename,
} from "@/lib/evalLocal/listEvalFiles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Historical evaluation (internal) — ExpoPrint",
  description: "Password-protected historical evaluation viewer (sample data).",
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
        <h1 className="mt-8 text-xl font-semibold">Historical evaluation</h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-600">
          Internal eval viewer is not configured. Set{" "}
          <code className="rounded bg-zinc-100 px-1 font-mono text-xs">
            INTERNAL_EVAL_PASSWORD
          </code>{" "}
          in the deployment environment.
        </p>
      </div>
    </div>
  );
}

type PageProps = {
  searchParams: Promise<{ summary?: string; review?: string }>;
};

export default async function InternalEvalPage({ searchParams }: PageProps) {
  const password = getInternalEvalPassword();
  if (!password) {
    return <NotConfigured />;
  }

  const authed = await isInternalEvalAuthenticated();
  if (!authed) {
    return <InternalEvalLogin />;
  }

  const params = await searchParams;
  const index = await listInternalEvalFiles();
  const summaryName = pickSummaryFilename(
    index.extractionSummaries,
    params.summary,
  );
  const reviewName = pickReviewQueueFilename(index.reviewQueues, params.review);

  const summaryData = summaryName
    ? await readInternalExtractionSummary(summaryName)
    : null;
  const reviewData = reviewName
    ? await readInternalReviewQueue(reviewName)
    : null;

  return (
    <EvalViewer
      basePath="/internal/eval"
      subtitle="Deployed review UI — sanitized sample data only."
      safetyNote="Password-protected · sample data · no partner exports"
      index={index}
      summaryName={summaryName}
      reviewName={reviewName}
      summaryData={summaryData}
      reviewData={reviewData}
      searchParams={params}
      showCliHints={false}
    />
  );
}
