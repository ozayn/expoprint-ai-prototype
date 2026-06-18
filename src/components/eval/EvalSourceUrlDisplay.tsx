"use client";

import { EvalExternalLink } from "./EvalExternalLink";
import type { ParsedSourceUrlDisplay } from "@/lib/evalLocal/evalSourceUrlDisplay";

export function EvalSourceUrlDisplay({
  display,
  className = "",
  mono = false,
  stopPropagation = false,
}: {
  display: ParsedSourceUrlDisplay;
  className?: string;
  mono?: boolean;
  stopPropagation?: boolean;
}) {
  const { href, fullUrl, host, pathSuffix } = display;
  const monoClass = mono ? "font-mono" : "";

  const content = (
    <span className={`block min-w-0 ${className}`.trim()}>
      <span
        className={`block min-w-0 truncate [overflow-wrap:anywhere] ${monoClass} text-[12px] text-zinc-700`}
      >
        {host}
      </span>
      {pathSuffix ? (
        <span
          className={`mt-0.5 block min-w-0 line-clamp-2 break-all text-[11px] leading-snug text-zinc-400 [overflow-wrap:anywhere] ${monoClass}`}
        >
          {pathSuffix}
        </span>
      ) : null}
    </span>
  );

  if (!href) {
    return (
      <span className="block min-w-0" title={fullUrl !== "—" ? fullUrl : undefined}>
        {content}
      </span>
    );
  }

  return (
    <EvalExternalLink
      href={href}
      className="block min-w-0"
      mono={false}
      stopPropagation={stopPropagation}
      title={fullUrl}
    >
      {content}
    </EvalExternalLink>
  );
}
