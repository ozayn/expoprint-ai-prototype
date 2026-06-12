"use client";

import type { ReactNode } from "react";
import {
  hrefForReviewRow,
  hrefForUrlField,
  safeHttpHref,
} from "@/lib/evalLocal/evalRowUrl";
import { sourceLabelForRow } from "@/lib/evalLocal/brandExtractionParse";
import type { ReviewQueueRow } from "@/lib/evalLocal/reviewQueueTypes";

const LINK_CLASS =
  "text-inherit decoration-transparent hover:underline hover:decoration-zinc-300 underline-offset-2";

export function EvalExternalLink({
  href,
  children,
  className = "",
  mono = false,
  stopPropagation = false,
}: {
  href: string | null;
  children: ReactNode;
  className?: string;
  mono?: boolean;
  stopPropagation?: boolean;
}) {
  const textClass = `${mono ? "font-mono" : ""} ${className}`.trim();

  if (!href) {
    return <span className={textClass}>{children}</span>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={`${LINK_CLASS} ${textClass}`}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
    >
      {children}
    </a>
  );
}

export function EvalSourceLink({
  row,
  className = "",
  mono = false,
  stopPropagation = false,
}: {
  row: ReviewQueueRow;
  className?: string;
  mono?: boolean;
  stopPropagation?: boolean;
}) {
  return (
    <EvalExternalLink
      href={hrefForReviewRow(row)}
      className={className}
      mono={mono}
      stopPropagation={stopPropagation}
    >
      {sourceLabelForRow(row)}
    </EvalExternalLink>
  );
}

export function EvalUrlDetailField({
  label,
  value,
  row,
  mono = true,
}: {
  label: string;
  value: string;
  row?: ReviewQueueRow;
  mono?: boolean;
}) {
  const display = value.trim();
  const href = hrefForUrlField(display, row);

  if (!display && !href) return null;

  return (
    <div>
      <dt className="text-[11px] text-zinc-400">{label}</dt>
      <dd className="mt-0.5 break-all text-sm text-zinc-800">
        <EvalExternalLink href={href} mono={mono}>
          {display || href}
        </EvalExternalLink>
      </dd>
    </div>
  );
}

/** Standalone URL text (e.g. logo URLs in expanded details). */
export function EvalExternalUrlText({
  url,
  className = "",
  mono = true,
}: {
  url: string;
  className?: string;
  mono?: boolean;
}) {
  const trimmed = url.trim();
  if (!trimmed) return null;

  return (
    <EvalExternalLink href={safeHttpHref(trimmed)} className={className} mono={mono}>
      {trimmed}
    </EvalExternalLink>
  );
}
