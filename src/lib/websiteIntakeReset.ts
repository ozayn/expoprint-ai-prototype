import { normalizeDomainForComparison } from "@/lib/analyzeWebsiteDomain";
import {
  computeDesignBriefText,
  emptyExtracted,
  type DesignIntakeState,
} from "@/lib/designIntakeState";

export const WEBSITE_CHANGED_RESET_NOTE =
  "Website changed — previous analysis cleared.";

/**
 * True when the user typed a different registrable domain than the last successful analyze.
 * Incomplete URLs (no domain yet) do not trigger a reset.
 */
export function typedDomainDiffersFromLastAnalyzed(
  lastAnalyzedDomain: string,
  nextWebsiteUrl: string,
): boolean {
  const analyzed = normalizeDomainForComparison(lastAnalyzedDomain);
  if (!analyzed) return false;
  const typed = normalizeDomainForComparison(nextWebsiteUrl);
  if (!typed) return false;
  return typed !== analyzed;
}

/** Website-specific intake fields cleared when the URL domain changes. */
export function clearedWebsiteSpecificIntake(
  prev: DesignIntakeState,
  nextWebsiteUrl: string,
  businessName: string,
): DesignIntakeState {
  const next: DesignIntakeState = {
    ...prev,
    websiteUrl: nextWebsiteUrl,
    businessName,
    extracted: emptyExtracted(),
    showExtracted: false,
    extractionSource: "none",
    logoCandidates: [],
    selectedLogoCandidateUrl: "",
    typographySignals: null,
    designBrief: "",
  };
  return { ...next, designBrief: computeDesignBriefText(next) };
}

export type IntakePatchMergeContext = {
  /** Domain for which the user manually set businessName after a URL change. */
  businessNamePreservedForDomain: string | null;
  setBusinessNamePreservedForDomain: (domain: string | null) => void;
};

export type IntakePatchMergeResult = {
  next: DesignIntakeState;
  websiteChangedNote: string | null;
  didClearStaleWebsiteData: boolean;
};

/**
 * Apply a partial intake update; clears stale website analysis when the typed domain
 * differs from `lastAnalyzedDomain`.
 */
export function mergeIntakePatch(
  prev: DesignIntakeState,
  patch: Partial<DesignIntakeState>,
  ctx: IntakePatchMergeContext,
): IntakePatchMergeResult {
  if (
    "websiteUrl" in patch &&
    typeof patch.websiteUrl === "string" &&
    typedDomainDiffersFromLastAnalyzed(prev.lastAnalyzedDomain, patch.websiteUrl)
  ) {
    const nextUrl = patch.websiteUrl;
    const nextDomain = normalizeDomainForComparison(nextUrl);
    const preserveName =
      nextDomain &&
      ctx.businessNamePreservedForDomain === nextDomain &&
      prev.businessName.trim()
        ? prev.businessName.trim()
        : "";

    if (nextDomain && ctx.businessNamePreservedForDomain !== nextDomain) {
      ctx.setBusinessNamePreservedForDomain(null);
    }

    const cleared = clearedWebsiteSpecificIntake(prev, nextUrl, preserveName);
    return {
      next: cleared,
      websiteChangedNote: WEBSITE_CHANGED_RESET_NOTE,
      didClearStaleWebsiteData: true,
    };
  }

  const next = { ...prev, ...patch };

  if ("businessName" in patch) {
    const domain = normalizeDomainForComparison(next.websiteUrl);
    const name = typeof patch.businessName === "string" ? patch.businessName.trim() : "";
    if (name && domain) {
      ctx.setBusinessNamePreservedForDomain(domain);
    } else if (!name) {
      ctx.setBusinessNamePreservedForDomain(null);
    }
  }

  const patchKeys = Object.keys(patch) as (keyof DesignIntakeState)[];
  const onlyBriefEdited =
    patchKeys.length === 1 && patchKeys[0] === "designBrief";
  const withBrief = onlyBriefEdited
    ? next
    : { ...next, designBrief: computeDesignBriefText(next) };

  return {
    next: withBrief,
    websiteChangedNote: null,
    didClearStaleWebsiteData: false,
  };
}
