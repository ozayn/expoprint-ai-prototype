import type { Metadata } from "next";
import Link from "next/link";
import { InternalEvalLogin } from "./InternalEvalLogin";
import { InternalEvalLogout } from "./InternalEvalLogout";
import { ReviewQueueTable } from "@/components/eval/ReviewQueueTable";
import {
  getEvalViewerPassword,
  isEvalViewerAuthenticated,
  isEvalViewerConfiguredInProduction,
} from "@/lib/evalInternal/auth";
import { readPublicSampleReview } from "@/lib/evalInternal/readPublicSampleReview";

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
          Evaluation viewer is not configured.
        </p>
      </div>
    </div>
  );
}

export default async function InternalEvalPage() {
  if (!isEvalViewerConfiguredInProduction()) {
    return <NotConfigured />;
  }

  const password = getEvalViewerPassword();
  const authed = await isEvalViewerAuthenticated();
  if (password && !authed) {
    return <InternalEvalLogin />;
  }

  const reviewData = await readPublicSampleReview();

  return (
    <div className="min-h-full bg-white text-zinc-900">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-10">
          <nav className="text-sm text-zinc-500">
            <Link href="/" className="hover:text-zinc-800">
              Back to editor
            </Link>
            <span className="mx-2 text-zinc-300">/</span>
            <Link href="/progress" className="hover:text-zinc-800">
              Progress
            </Link>
          </nav>

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
                Historical evaluation
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Deployed review UI — sanitized sample data only.
              </p>
            </div>
            {password ? <InternalEvalLogout /> : null}
          </div>

          <p className="mt-6 rounded-md border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm leading-relaxed text-amber-950">
            Deployed viewer uses sanitized sample data. Real partner evaluation
            files remain local unless connected to private storage later.
          </p>
        </header>

        <section>
          <h2 className="text-sm font-medium text-zinc-900">Review queue</h2>

          {reviewData.rows.length > 0 ? (
            <div className="mt-6">
              <ReviewQueueTable
                filename={reviewData.filename}
                rows={reviewData.rows}
              />
            </div>
          ) : (
            <p className="mt-6 text-sm text-zinc-500">
              Sample review fixture has no rows.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
