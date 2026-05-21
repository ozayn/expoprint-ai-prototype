"use client";

import { InfoTooltip } from "@/components/InfoTooltip";
import type { ExtractionSource } from "@/lib/designIntakeState";
import { HELP_TYPOGRAPHY_SIGNALS } from "@/lib/editorHelpCopy";
import { formatTypographySignalsLine } from "@/lib/typographyMapping";
import type { TypographySignals } from "@/lib/typographySignals";

export type TypographySignalsRowProps = {
  signals: TypographySignals | null | undefined;
  /** Set after Analyze Website — used for mock vs real extraction messaging. */
  extractionSource: ExtractionSource;
  /** Editor uses compact labels + tooltip; demo keeps inline copy. */
  helperMode?: "inline" | "tooltip";
};

function hasDetectedSignals(signals: TypographySignals | null | undefined): boolean {
  if (!signals) return false;
  return (
    signals.fontFamilies.length > 0 || signals.googleFontFamilies.length > 0
  );
}

/**
 * Compact typography hint under Review identity (editor + guided demo).
 * Render only after Analyze Website (parent gates on `showExtracted`).
 */
export function TypographySignalsRow({
  signals,
  extractionSource,
  helperMode = "inline",
}: TypographySignalsRowProps) {
  if (extractionSource === "none") {
    return null;
  }

  let detail: string;
  if (extractionSource === "mock_fallback") {
    detail = "Typography signals unavailable in mock fallback.";
  } else if (hasDetectedSignals(signals)) {
    detail =
      formatTypographySignalsLine(signals) ??
      "No typography signals detected from static HTML/CSS.";
  } else {
    detail = "No typography signals detected from static HTML/CSS.";
  }

  const label = (
    <span className="font-medium text-zinc-600">Typography signals</span>
  );

  return (
    <p
      className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] leading-snug text-zinc-500"
      data-testid="typography-signals"
      data-typography-state={
        extractionSource === "mock_fallback"
          ? "mock"
          : hasDetectedSignals(signals)
            ? "detected"
            : "empty"
      }
    >
      {helperMode === "tooltip" ? (
        <>
          {label}
          <InfoTooltip
            label="About typography signals"
            titleText={HELP_TYPOGRAPHY_SIGNALS}
          >
            {HELP_TYPOGRAPHY_SIGNALS}
          </InfoTooltip>
          <span className="w-full text-zinc-500">{detail}</span>
        </>
      ) : (
        <>
          <span className="font-medium text-zinc-600">Typography signals:</span>{" "}
          {detail}
        </>
      )}
    </p>
  );
}
