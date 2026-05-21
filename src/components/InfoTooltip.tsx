"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type InfoTooltipProps = {
  /** Accessible name for the trigger (e.g. "About Analyze Website"). */
  label: string;
  children: ReactNode;
  /** Plain-text fallback for native `title` on touch devices. */
  titleText?: string;
};

/**
 * Small “i” help control — helper copy on hover, focus, or tap (mobile).
 */
export function InfoTooltip({ label, children, titleText }: InfoTooltipProps) {
  const tooltipId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [pinned, setPinned] = useState(false);

  const plainTitle =
    titleText ??
    (typeof children === "string" ? children : label);

  const close = useCallback(() => setPinned(false), []);

  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pinned, close]);

  useEffect(() => {
    if (!pinned) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [pinned, close]);

  return (
    <span
      ref={wrapRef}
      className="group/info relative inline-flex shrink-0 align-middle"
    >
      <button
        type="button"
        className="inline-flex size-5 cursor-help items-center justify-center rounded-full border border-zinc-200 bg-white text-[10px] font-semibold leading-none text-zinc-500 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-400"
        aria-label={label}
        aria-expanded={pinned}
        aria-describedby={pinned ? tooltipId : undefined}
        title={plainTitle}
        onClick={() => setPinned((v) => !v)}
      >
        <span aria-hidden>i</span>
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={`absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-[min(16rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-left text-[11px] leading-snug text-zinc-600 shadow-md transition-opacity ${
          pinned
            ? "pointer-events-auto visible opacity-100"
            : "pointer-events-none invisible opacity-0 group-hover/info:visible group-hover/info:opacity-100 group-focus-within/info:visible group-focus-within/info:opacity-100"
        }`}
      >
        {children}
      </span>
    </span>
  );
}

export type SectionHeadingWithInfoProps = {
  id: string;
  title: string;
  tooltipLabel: string;
  tooltip: ReactNode;
  className?: string;
};

/** Section title with adjacent info icon (editor panels). */
export function SectionHeadingWithInfo({
  id,
  title,
  tooltipLabel,
  tooltip,
  className = "text-sm font-semibold tracking-tight text-zinc-900",
}: SectionHeadingWithInfoProps) {
  return (
    <div className="flex items-center gap-1.5">
      <h2 id={id} className={className}>
        {title}
      </h2>
      <InfoTooltip label={tooltipLabel}>{tooltip}</InfoTooltip>
    </div>
  );
}
