import type { LogoCandidate } from "@/lib/analyzeWebsiteResponse";
import { enrichLogoCandidatesTransparency } from "@/lib/server/enrichLogoCandidateTransparency";
import {
  filterLogoCandidatesForDesignUi,
  sortLogoCandidatesByScore,
  type LogoRankingContext,
  type ScoredLogoCandidate,
} from "@/lib/logoCandidateRanking";

/**
 * Rank, optionally enrich transparency for top rows, and cap for the review grid.
 */
export async function prepareLogoCandidatesForUi(
  candidates: LogoCandidate[],
  maxForUi = 6,
  ctx: LogoRankingContext = { brandTokens: [] },
): Promise<LogoCandidate[]> {
  if (candidates.length === 0) return [];
  const sorted = sortLogoCandidatesByScore(candidates, ctx);
  const enriched = await enrichLogoCandidatesTransparency(sorted, maxForUi * 2);
  const filtered = filterLogoCandidatesForDesignUi(
    enriched as ScoredLogoCandidate[],
    ctx,
    maxForUi,
  );
  return filtered;
}
