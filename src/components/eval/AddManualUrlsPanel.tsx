"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  MANUAL_URL_DELAY_MS,
  MANUAL_URL_MAX,
} from "@/lib/evalLocal/manualUrlValidation";
import type { ManualUrlBatchResult } from "@/lib/evalLocal/runManualUrlBatch";

type Props = {
  basePath: string;
};

export function AddManualUrlsPanel({ basePath }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [urls, setUrls] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ManualUrlBatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/dev/eval/manual-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls,
          projectTitle: projectTitle.trim() || undefined,
        }),
      });

      const data = (await res.json()) as ManualUrlBatchResult & {
        ok?: boolean;
        error?: string;
      };

      if (!res.ok || (data.error && !data.runId)) {
        setError(data.error ?? "Processing failed.");
        if (data.runId) setResult(data);
        return;
      }

      setResult(data);
      if (data.reviewFilename) {
        const q = new URLSearchParams();
        q.set("review", data.reviewFilename);
        if (data.summaryFilename) q.set("summary", data.summaryFilename);
        router.push(`${basePath}?${q.toString()}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-900">Manual URL intake</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Process extra websites outside Metabase exports. Max {MANUAL_URL_MAX} URLs per
            batch; {MANUAL_URL_DELAY_MS / 1000}s delay between requests.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
        >
          {open ? "Close" : "Add URLs"}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
          <label className="block text-xs font-medium text-zinc-700">
            URLs (one per line)
            <textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              rows={5}
              placeholder="https://example.com&#10;another-brand.com"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300"
              disabled={submitting}
            />
          </label>

          <label className="block text-xs font-medium text-zinc-700">
            Label / project title (optional)
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="Defaults to domain when blank"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300"
              disabled={submitting}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting || !urls.trim()}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {submitting ? "Processing…" : "Process URLs"}
            </button>
            {submitting && (
              <span className="text-xs text-zinc-500">
                Extraction may take a minute per URL.
              </span>
            )}
          </div>
        </form>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {result?.runId && (
        <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          <p>
            <span className="font-medium text-zinc-900">Run {result.runId}</span>
            — {result.successCount} success, {result.errorCount} error
            {result.skippedCount > 0 ? `, ${result.skippedCount} skipped` : ""}.
          </p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-600">
            <li>{result.jsonlFilename}</li>
            <li>{result.summaryFilename}</li>
            <li>{result.reviewFilename}</li>
          </ul>
          {result.urlResults.some((r) => r.status === "validation_error") && (
            <ul className="mt-2 space-y-1 text-xs text-amber-800">
              {result.urlResults
                .filter((r) => r.status === "validation_error")
                .map((r, i) => (
                  <li key={i}>
                    {r.url ? `${r.url}: ` : ""}
                    {r.error_message}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
