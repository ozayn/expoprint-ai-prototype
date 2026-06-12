"use client";

import {
  colorEntriesForRow,
  logoCandidatesForRow,
  proxiedEvalImageSrc,
  type ParsedColorEntry,
  type ParsedLogoCandidate,
} from "@/lib/evalLocal/brandExtractionParse";
import type { ReviewQueueRow } from "@/lib/evalLocal/reviewQueueTypes";

function logoCandidateTotal(row: ReviewQueueRow): number {
  const parsed = Number.parseInt(row.logo_candidate_count ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return logoCandidatesForRow(row, 99).length;
}

function LogoThumb({
  candidate,
  selected,
  size = "sm",
}: {
  candidate: ParsedLogoCandidate;
  selected: boolean;
  size?: "sm" | "md";
}) {
  const box =
    size === "sm"
      ? "h-8 w-8"
      : "h-9 w-9";

  return (
    <div className="relative shrink-0">
      <div
        className={`flex ${box} items-center justify-center overflow-hidden rounded border bg-white ${
          selected ? "border-zinc-400 ring-1 ring-zinc-300" : "border-zinc-200"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={proxiedEvalImageSrc(candidate.url)}
          alt=""
          className="max-h-full max-w-full object-contain p-0.5"
          loading="lazy"
        />
      </div>
      {selected && size !== "sm" ? (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-zinc-500">
          best
        </span>
      ) : null}
    </div>
  );
}

export function LogoThumbnailRow({
  row,
  max = 5,
  emptyLabel = "No logos",
  showExtraCount = false,
  size = "md",
}: {
  row: ReviewQueueRow;
  max?: number;
  emptyLabel?: string;
  showExtraCount?: boolean;
  size?: "sm" | "md";
}) {
  const candidates = logoCandidatesForRow(row, max);
  const selectedUrl = row.selected_logo_url?.trim();

  if (candidates.length === 0) {
    return <span className="text-[11px] text-zinc-400">{emptyLabel}</span>;
  }

  const total = logoCandidateTotal(row);
  const extra = showExtraCount && total > candidates.length ? total - candidates.length : 0;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {candidates.map((candidate) => (
        <LogoThumb
          key={candidate.url}
          candidate={candidate}
          selected={
            selectedUrl.length > 0 && candidate.url.trim() === selectedUrl
          }
          size={size}
        />
      ))}
      {extra > 0 ? (
        <span className="text-[10px] text-zinc-400">+{extra}</span>
      ) : null}
    </div>
  );
}

export function ColorSwatch({
  entry,
  compact = false,
}: {
  entry: ParsedColorEntry;
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-zinc-600 ${
        compact ? "text-[10px]" : "text-[11px]"
      }`}
    >
      <span
        className={`shrink-0 rounded-sm border border-zinc-200/80 ${
          compact ? "h-3 w-3" : "h-3.5 w-3.5"
        }`}
        style={{ backgroundColor: entry.hex }}
        title={entry.label ? `${entry.label} ${entry.hex}` : entry.hex}
      />
      <span className="font-mono">{entry.hex}</span>
      {!compact && entry.label ? (
        <span className="text-zinc-400">{entry.label}</span>
      ) : null}
    </span>
  );
}

export function ColorSwatchRow({
  row,
  max = 8,
  emptyLabel = "No colors",
  compact = false,
}: {
  row: ReviewQueueRow;
  max?: number;
  emptyLabel?: string;
  compact?: boolean;
}) {
  const all = colorEntriesForRow(row);
  const entries = all.slice(0, max);
  const extra = all.length - entries.length;

  if (entries.length === 0) {
    return <span className="text-[11px] text-zinc-400">{emptyLabel}</span>;
  }

  return (
    <div className={`flex flex-wrap items-center ${compact ? "gap-x-2 gap-y-0.5" : "gap-x-3 gap-y-1.5"}`}>
      {entries.map((entry) => (
        <ColorSwatch
          key={`${entry.hex}-${entry.label ?? ""}`}
          entry={entry}
          compact={compact}
        />
      ))}
      {extra > 0 ? (
        <span className="text-[10px] text-zinc-400">+{extra}</span>
      ) : null}
    </div>
  );
}

export function LogoCandidateDetailList({
  row,
  max = 5,
}: {
  row: ReviewQueueRow;
  max?: number;
}) {
  const candidates = logoCandidatesForRow(row, max);
  const selectedUrl = row.selected_logo_url?.trim();

  if (candidates.length === 0) {
    return <p className="text-sm text-zinc-400">No logo candidates.</p>;
  }

  return (
    <ul className="space-y-3">
      {candidates.map((candidate) => {
        const isSelected =
          selectedUrl.length > 0 && candidate.url.trim() === selectedUrl;
        const meta = [candidate.source, candidate.logoRole]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={candidate.url} className="flex items-start gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border bg-white ${
                isSelected ? "border-zinc-400" : "border-zinc-200"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proxiedEvalImageSrc(candidate.url)}
                alt=""
                className="max-h-full max-w-full object-contain p-1"
                loading="lazy"
              />
            </div>
            <div className="min-w-0 text-xs">
              {isSelected ? (
                <span className="text-zinc-500">Selected · </span>
              ) : null}
              <a
                href={candidate.url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
              >
                {candidate.url}
              </a>
              {meta ? <p className="mt-0.5 text-zinc-400">{meta}</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
