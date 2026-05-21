"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const TOOLTIP_MAX_WIDTH_PX = 280;
const VIEWPORT_MARGIN_PX = 8;
const TRIGGER_GAP_PX = 6;
const TOOLTIP_Z_INDEX = 9999;

export type InfoTooltipProps = {
  /** Accessible name for the trigger (e.g. "About Analyze Website"). */
  label: string;
  children: ReactNode;
  /** Plain-text fallback for native `title` on touch devices. */
  titleText?: string;
};

type TooltipCoords = {
  top: number;
  left: number;
  placement: "top" | "bottom";
};

function measureTooltipPosition(
  trigger: HTMLElement,
  tooltipEl: HTMLElement,
): TooltipCoords {
  const rect = trigger.getBoundingClientRect();
  const tooltipWidth = Math.min(
    tooltipEl.offsetWidth || TOOLTIP_MAX_WIDTH_PX,
    window.innerWidth - VIEWPORT_MARGIN_PX * 2,
  );
  const tooltipHeight = tooltipEl.offsetHeight;

  const spaceAbove = rect.top - VIEWPORT_MARGIN_PX;
  const spaceBelow =
    window.innerHeight - VIEWPORT_MARGIN_PX - rect.bottom;

  let placement: "top" | "bottom" = "top";
  if (
    spaceAbove < tooltipHeight + TRIGGER_GAP_PX &&
    spaceBelow >= spaceAbove
  ) {
    placement = "bottom";
  }

  let top =
    placement === "top"
      ? rect.top - TRIGGER_GAP_PX - tooltipHeight
      : rect.bottom + TRIGGER_GAP_PX;

  top = Math.max(
    VIEWPORT_MARGIN_PX,
    Math.min(top, window.innerHeight - VIEWPORT_MARGIN_PX - tooltipHeight),
  );

  let left = rect.left + rect.width / 2 - tooltipWidth / 2;
  left = Math.max(
    VIEWPORT_MARGIN_PX,
    Math.min(
      left,
      window.innerWidth - VIEWPORT_MARGIN_PX - tooltipWidth,
    ),
  );

  return { top, left, placement };
}

/**
 * Small “i” help control — helper copy on hover, focus, or tap (mobile).
 * Tooltip content is portaled to `document.body` with fixed positioning.
 */
export function InfoTooltip({ label, children, titleText }: InfoTooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [coords, setCoords] = useState<TooltipCoords | null>(null);

  const open = pinned || hovered || focused;

  const plainTitle =
    titleText ??
    (typeof children === "string" ? children : label);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;
    setCoords(measureTooltipPosition(trigger, tooltip));
  }, []);

  const closeAll = useCallback(() => {
    setPinned(false);
    setHovered(false);
    setFocused(false);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition, children]);

  useEffect(() => {
    if (!open) return;

    const onScrollOrResize = () => updatePosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);

    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pinned, closeAll]);

  useEffect(() => {
    if (!pinned) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (tooltipRef.current?.contains(target)) return;
      closeAll();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [pinned, closeAll]);

  const tooltipNode =
    open && mounted ? (
      <div
        id={tooltipId}
        ref={tooltipRef}
        role="tooltip"
        style={{
          position: "fixed",
          top: coords?.top ?? -9999,
          left: coords?.left ?? -9999,
          zIndex: TOOLTIP_Z_INDEX,
          maxWidth: TOOLTIP_MAX_WIDTH_PX,
          visibility: coords ? "visible" : "hidden",
        }}
        className="w-max rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-left text-[11px] leading-snug text-zinc-600 shadow-lg"
        data-placement={coords?.placement}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          if (!pinned) setHovered(false);
        }}
      >
        {children}
      </div>
    ) : null;

  return (
    <span
      ref={wrapRef}
      className="inline-flex shrink-0 align-middle"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        if (!pinned) setHovered(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex size-5 cursor-help items-center justify-center rounded-full border border-zinc-200 bg-white text-[10px] font-semibold leading-none text-zinc-500 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-400"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        title={plainTitle}
        onClick={() => setPinned((v) => !v)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => {
          const next = e.relatedTarget as Node | null;
          if (wrapRef.current?.contains(next)) return;
          if (tooltipRef.current?.contains(next)) return;
          if (!pinned) setFocused(false);
        }}
      >
        <span aria-hidden>i</span>
      </button>
      {mounted && tooltipNode
        ? createPortal(tooltipNode, document.body)
        : null}
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
