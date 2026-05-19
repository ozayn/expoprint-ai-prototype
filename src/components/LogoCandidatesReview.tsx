"use client";

import { useState } from "react";
import type {
  LogoCandidate,
  LogoCandidateSource,
} from "@/lib/analyzeWebsiteResponse";

const SOURCE_LABEL: Record<LogoCandidateSource, string> = {
  icon: "favicon",
  "apple-touch-icon": "apple touch icon",
  "og:image": "og:image",
  "img-logo": "logo image",
  "header-image": "header image",
  unknown: "image",
};

const PROTOTYPE_NOTE =
  "Prototype note: remote logos are not embedded into the Fabric export yet; selected logo URLs are recorded for designer review.";

export type LogoCandidatesReviewProps = {
  candidates: LogoCandidate[];
  selectedUrl: string;
  onSelect: (url: string) => void;
  /** Visual density helper — guided demo uses a slightly larger thumbnail. */
  variant?: "compact" | "wide";
};

/**
 * Compact, conventional review grid for logo image candidates discovered by the
 * website extraction. Designers can pick one as the working choice; production
 * upload is still expected later. Failed image loads fall back to a small mark.
 *
 * The component is render-after-Analyze: callers gate it on `showExtracted` so
 * the empty state ("0 logo candidates found") only appears after a real run.
 */
export function LogoCandidatesReview({
  candidates,
  selectedUrl,
  onSelect,
  variant = "compact",
}: LogoCandidatesReviewProps) {
  const thumb = variant === "wide" ? "h-16 w-16" : "h-14 w-14";
  const countLabel = `${candidates.length} logo candidate${
    candidates.length === 1 ? "" : "s"
  } found`;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
          Logo candidates
        </p>
        <p
          className="text-[11px] text-zinc-500"
          aria-live="polite"
          data-testid="logo-candidate-count"
        >
          {countLabel}
        </p>
      </div>

      {candidates.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-200 bg-zinc-50/60 px-3 py-3 text-xs leading-snug text-zinc-600">
          <p className="font-medium text-zinc-700">
            No usable logo image candidate found from the website.
          </p>
          <p className="mt-1 text-zinc-500">
            Designers should request or upload a production-quality logo file.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs leading-snug text-zinc-500">
            Logo candidates found from the website. Designers should confirm or
            upload a production-quality logo.
          </p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {candidates.map((c) => (
              <LogoCandidateCard
                key={c.url}
                candidate={c}
                selected={c.url === selectedUrl}
                onSelect={onSelect}
                thumbClass={thumb}
              />
            ))}
          </ul>
          {selectedUrl ? (
            <div className="rounded-md border border-emerald-100 bg-emerald-50/70 px-2.5 py-2 text-[11px] leading-snug">
              <p className="font-medium text-emerald-800">
                Selected logo is recorded for designer review.
              </p>
              <p className="mt-0.5 text-emerald-900/80">
                Production-quality logo upload is still recommended.
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p
                  className="truncate text-[11px] text-emerald-900/80"
                  title={selectedUrl}
                >
                  {selectedUrl}
                </p>
                <button
                  type="button"
                  className="shrink-0 rounded border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-800 shadow-sm hover:bg-emerald-50"
                  onClick={() => onSelect("")}
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <p className="rounded-md border border-zinc-100 bg-zinc-50/60 px-2.5 py-2 text-[11px] leading-snug text-zinc-500">
        {PROTOTYPE_NOTE}
      </p>
    </div>
  );
}

type LogoCandidateCardProps = {
  candidate: LogoCandidate;
  selected: boolean;
  onSelect: (url: string) => void;
  thumbClass: string;
};

function LogoCandidateCard({
  candidate,
  selected,
  onSelect,
  thumbClass,
}: LogoCandidateCardProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const sourceLabel = SOURCE_LABEL[candidate.source] ?? "image";
  const host = hostnameOf(candidate.url);
  const dims =
    candidate.width && candidate.height
      ? `${candidate.width}×${candidate.height}`
      : "";
  /** Compact second row: host always, dims appended when known. */
  const metaLine = [host || "image", dims].filter(Boolean).join(" · ");

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(selected ? "" : candidate.url)}
        aria-pressed={selected}
        title={candidate.alt || candidate.url}
        className={`group flex w-full items-center gap-2 rounded-md border bg-white px-2 py-2 text-left shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
          selected
            ? "border-zinc-900 ring-1 ring-zinc-900/10"
            : "border-zinc-200 hover:border-zinc-300"
        }`}
      >
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-100 bg-zinc-50 ${thumbClass}`}
          aria-hidden
        >
          {loadFailed ? (
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
              N/A
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={candidate.url}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-contain"
              onError={() => setLoadFailed(true)}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-zinc-700">
            {sourceLabel}
          </p>
          <p className="truncate text-[10px] text-zinc-400">{metaLine}</p>
          {selected ? (
            <p className="truncate text-[10px] font-medium text-zinc-900">
              In use
            </p>
          ) : (
            <p className="truncate text-[10px] text-zinc-400 group-hover:text-zinc-500">
              Use this logo
            </p>
          )}
        </div>
      </button>
    </li>
  );
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
