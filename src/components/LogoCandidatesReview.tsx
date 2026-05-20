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

const HELPER_COPY =
  "Ranked for design use. Designers should confirm or upload a production-quality logo.";

export type LogoCandidatesReviewProps = {
  candidates: LogoCandidate[];
  selectedUrl: string;
  onSelect: (url: string) => void;
  /** Visual density helper — guided demo uses a slightly larger preview area. */
  variant?: "compact" | "wide";
};

/**
 * Compact review grid for logo candidates (server-ranked). First card is the best
 * match; designers pick one manually — no auto-select.
 */
export function LogoCandidatesReview({
  candidates,
  selectedUrl,
  onSelect,
  variant = "compact",
}: LogoCandidatesReviewProps) {
  const previewHeight = variant === "wide" ? "h-28" : "h-24";
  const countLabel = `${candidates.length} logo candidate${
    candidates.length === 1 ? "" : "s"
  } found`;

  return (
    <div className="space-y-3">
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
        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-3 py-3 text-xs leading-snug text-zinc-600">
          <p className="font-medium text-zinc-700">
            No usable logo image candidate found from the website.
          </p>
          <p className="mt-1 text-zinc-500">
            Designers should request or upload a production-quality logo file.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs leading-snug text-zinc-500">{HELPER_COPY}</p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {candidates.map((c, index) => (
              <LogoCandidateCard
                key={c.url}
                candidate={c}
                selected={c.url === selectedUrl}
                onSelect={onSelect}
                previewHeightClass={previewHeight}
                isBestMatch={index === 0}
              />
            ))}
          </ul>
          {selectedUrl ? (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2.5 text-xs leading-snug">
              <p className="font-medium text-emerald-800">
                Selected logo appears in the editable preview when it can be
                loaded safely.
              </p>
              <p className="mt-1 text-emerald-900/80">
                Production-quality logo upload is still recommended.
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p
                  className="min-w-0 truncate text-[11px] text-emerald-900/70"
                  title={selectedUrl}
                >
                  {truncateMiddle(selectedUrl, 48)}
                </p>
                <button
                  type="button"
                  className="shrink-0 rounded-md border border-emerald-200 bg-white px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-50"
                  onClick={() => onSelect("")}
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

type LogoCandidateCardProps = {
  candidate: LogoCandidate;
  selected: boolean;
  onSelect: (url: string) => void;
  previewHeightClass: string;
  isBestMatch: boolean;
};

function LogoCandidateCard({
  candidate,
  selected,
  onSelect,
  previewHeightClass,
  isBestMatch,
}: LogoCandidateCardProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const sourceLabel = SOURCE_LABEL[candidate.source] ?? "image";
  const host = hostnameOf(candidate.url);
  const dims =
    candidate.width && candidate.height
      ? `${candidate.width}×${candidate.height}`
      : "";
  const penalized = isProductAppIconPenalty(candidate.reason);
  const showTransparentBadge =
    candidate.transparency === "likely_transparent" && !penalized;

  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={() => onSelect(selected ? "" : candidate.url)}
        aria-pressed={selected}
        title={candidate.alt || candidate.url}
        className={`flex h-full min-h-[168px] w-full min-w-0 flex-col rounded-lg border bg-white p-2.5 text-center shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
          selected
            ? "border-zinc-900 ring-1 ring-zinc-900/10"
            : isBestMatch
              ? "border-zinc-400 hover:border-zinc-500"
              : penalized
                ? "border-zinc-100 bg-zinc-50/40 hover:border-zinc-200"
                : "border-zinc-200 hover:border-zinc-300"
        }`}
      >
        <div
          className={`flex w-full shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-100 bg-zinc-50 ${previewHeightClass}`}
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
              className="max-h-full max-w-full object-contain p-1"
              onError={() => setLoadFailed(true)}
            />
          )}
        </div>

        <p
          className="mt-2 w-full truncate px-0.5 text-[11px] font-medium text-zinc-700"
          title={sourceLabel}
        >
          {sourceLabel}
        </p>
        {host || dims ? (
          <p
            className="mt-0.5 w-full truncate px-0.5 text-[10px] text-zinc-400"
            title={[host, dims].filter(Boolean).join(" · ")}
          >
            {[host, dims].filter(Boolean).join(" · ")}
          </p>
        ) : null}

        <div className="mt-1.5 flex min-h-[20px] w-full flex-wrap items-center justify-center gap-1 px-0.5">
          {isBestMatch ? (
            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-white">
              Best match
            </span>
          ) : null}
          {showTransparentBadge ? (
            <span className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] text-zinc-500">
              Transparent likely
            </span>
          ) : null}
          {penalized ? (
            <span className="text-[10px] text-zinc-400">Less likely logo</span>
          ) : null}
        </div>

        <p
          className={`mt-auto w-full pt-2 text-[11px] ${
            selected
              ? "font-semibold text-zinc-900"
              : "font-medium text-zinc-600"
          }`}
        >
          {selected ? "In use" : "Use this logo"}
        </p>
      </button>
    </li>
  );
}

function isProductAppIconPenalty(reason: string | undefined): boolean {
  return /penalized:\s*product\/app icon/i.test(reason ?? "");
}

function truncateMiddle(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const head = Math.ceil((maxLen - 1) / 2);
  const tail = Math.floor((maxLen - 1) / 2);
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
