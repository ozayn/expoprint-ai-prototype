import type { LogoCandidate } from "@/lib/analyzeWebsiteResponse";
import { enrichLogoCandidatesTransparency } from "@/lib/server/enrichLogoCandidateTransparency";
import {
  sortLogoCandidatesByScore,
  type LogoRankingContext,
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
  const enriched = await enrichLogoCandidatesTransparency(sorted, maxForUi);
  return enriched.slice(0, maxForUi);
}
