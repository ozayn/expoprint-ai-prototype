import type { LogoCandidate } from "@/lib/analyzeWebsiteResponse";
import type { DesignIntakeState } from "@/lib/designIntakeState";
import {
  buildLogoRankingContext,
  isStrongDesignLogoCandidate,
  scoreLogoCandidate,
  type LogoRankingContext,
} from "@/lib/logoCandidateRanking";
import {
  classifyLogoRole,
  logoRoleUiLabel,
  looksLikeSocialMediaContentThumbnail,
} from "@/lib/logoRoleClassification";

export type CanvasLogoResolution = {
  url: string;
  autoSelected: boolean;
  candidate: LogoCandidate | undefined;
};

function candidatePath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export function buildLogoRankingContextFromIntake(
  intake: Pick<DesignIntakeState, "businessName" | "websiteUrl">,
): LogoRankingContext {
  return buildLogoRankingContext({
    finalUrl: intake.websiteUrl,
    businessName: intake.businessName,
  });
}

/** True when the headline area already shows the business name as large text. */
export function businessNameShownOnCanvas(intake: DesignIntakeState): boolean {
  return intake.businessName.trim().length > 0;
}

function scoredCandidate(
  candidate: LogoCandidate,
  ctx: LogoRankingContext,
): LogoCandidate & { score: number; logoRole?: LogoCandidate["logoRole"] } {
  const scored = scoreLogoCandidate(candidate, ctx);
  return {
    ...scored,
    score: scored.score ?? 0,
    logoRole: scored.logoRole ?? classifyLogoRole(candidate, ctx),
  };
}

/** Compact icon / brand mark suitable for the canvas logo box when name is already in headline text. */
export function isGoodCanvasIconMark(
  candidate: LogoCandidate,
  ctx: LogoRankingContext,
): boolean {
  const scored = scoredCandidate(candidate, ctx);
  const role = scored.logoRole;
  const path = candidatePath(candidate.url);

  if (role === "marketing_image" || role === "social_preview") return false;
  if (looksLikeSocialMediaContentThumbnail(candidate)) return false;
  if (looksLikeProductAppIcon(scored.reason)) return false;

  if (role === "icon_mark") {
    return (
      isStrongDesignLogoCandidate(scored, ctx) ||
      (scored.score ?? 0) >= 48 ||
      /favicon\.svg|brand[_-]?icon|icon[_-]?mark|glyph|monogram/i.test(path)
    );
  }

  if (role === "fallback_icon") {
    if (/favicon\.svg|brand[_-]?icon|glyph/i.test(path)) return true;
    const max =
      typeof candidate.width === "number" && typeof candidate.height === "number"
        ? Math.max(candidate.width, candidate.height)
        : undefined;
    return Boolean(max && max >= 32 && max <= 96 && /\.svg(?:$|\?)/i.test(path));
  }

  return false;
}

function canvasIconPreferenceScore(
  candidate: LogoCandidate,
  ctx: LogoRankingContext,
): number {
  const scored = scoredCandidate(candidate, ctx);
  let score = scored.score ?? 0;
  const path = candidatePath(candidate.url);

  if (scored.logoRole === "icon_mark") score += 20;
  if (scored.logoRole === "fallback_icon") score += 4;
  if (/favicon\.svg(?:$|\?)/i.test(path)) score += 18;
  if (/brand[_-]?icon|icon[_-]?mark|glyph|monogram/i.test(path)) score += 10;
  if (isSquareish(scored)) score += 6;

  return score;
}

function isSquareish(candidate: LogoCandidate): boolean {
  const { width, height } = candidate;
  if (typeof width !== "number" || typeof height !== "number") return false;
  const ratio = width / height;
  return ratio >= 0.82 && ratio <= 1.22;
}

function looksLikeProductAppIcon(reason: string | undefined): boolean {
  return /penalized:\s*product\/app icon/i.test(reason ?? "");
}

/**
 * Best compact mark for canvas when the business name is already rendered as headline text.
 * Wordmarks remain in the ranked list for review — this only picks canvas display.
 */
export function pickBestCanvasLogoCandidate(
  candidates: LogoCandidate[],
  ctx: LogoRankingContext,
): LogoCandidate | null {
  let best: LogoCandidate | null = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    if (!isGoodCanvasIconMark(candidate, ctx)) continue;
    const score = canvasIconPreferenceScore(candidate, ctx);
    if (score > bestScore) {
      bestScore = score;
      best = scoredCandidate(candidate, ctx);
    }
  }

  return best;
}

/** Manual selection wins; otherwise prefer a compact icon mark when headline shows the business name. */
export function resolveCanvasLogo(intake: DesignIntakeState): CanvasLogoResolution {
  const manual = intake.selectedLogoCandidateUrl.trim();
  if (manual) {
    return {
      url: manual,
      autoSelected: false,
      candidate: intake.logoCandidates.find((c) => c.url === manual),
    };
  }

  if (!businessNameShownOnCanvas(intake)) {
    return { url: "", autoSelected: false, candidate: undefined };
  }

  const ctx = buildLogoRankingContextFromIntake(intake);
  const pick = pickBestCanvasLogoCandidate(intake.logoCandidates, ctx);
  const url = pick?.url?.trim() ?? "";
  return {
    url,
    autoSelected: url.length > 0,
    candidate: pick ?? undefined,
  };
}

export function logoRoleReviewLabel(candidate: LogoCandidate): string {
  const role = candidate.logoRole ?? "unknown";
  switch (role) {
    case "wordmark":
      return "Full wordmark";
    case "icon_mark":
      return "Compact mark";
    default:
      return logoRoleUiLabel(role);
  }
}

export function logoCanvasDesignLabel(
  candidateUrl: string,
  bestForCanvasUrl: string | null | undefined,
): string | null {
  if (!bestForCanvasUrl || candidateUrl !== bestForCanvasUrl) return null;
  return "Best for canvas";
}
