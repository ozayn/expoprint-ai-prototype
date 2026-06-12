import type { Metadata } from "next";
import Link from "next/link";
import { BrandAuditViewer } from "@/components/eval/BrandAuditViewer";
import { InternalEvalLogin } from "./InternalEvalLogin";
import { InternalEvalLogout } from "./InternalEvalLogout";
import {
  getEvalViewerPassword,
  isEvalViewerAuthenticated,
  isEvalViewerConfiguredInProduction,
} from "@/lib/evalInternal/auth";
import { readInternalEvalReview } from "@/lib/evalInternal/readInternalEvalReview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Historical brand audit (internal) — ExpoPrint",
  description: "Password-protected brand audit viewer (sample data).",
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
  searchParams: Promise<{ view?: string }>;
};

export default async function InternalEvalPage({ searchParams }: PageProps) {
  const params = await searchParams;
  if (!isEvalViewerConfiguredInProduction()) {
    return <NotConfigured />;
  }

  const password = getEvalViewerPassword();
  const authed = await isEvalViewerAuthenticated();
  if (password && !authed) {
    return <InternalEvalLogin />;
  }

  const reviewData = await readInternalEvalReview();
  const deployedNote =
    reviewData.source === "published"
      ? "Published sanitized evaluation data. Raw partner files remain local."
      : "No published eval file yet — showing built-in sample data. Run npm run eval:publish-internal locally, review the JSON, then commit data/eval/public/internal-eval-review.json.";

  return (
    <BrandAuditViewer
      basePath="/internal/eval"
      searchParams={params}
      subtitle="Historical websites processed through ExpoPrint."
      deployedNote={deployedNote}
      headerAction={password ? <InternalEvalLogout /> : undefined}
      reviewFilename={reviewData.filename}
      rows={reviewData.rows}
      emptyMessage="Sample review fixture has no rows."
    />
  );
}
