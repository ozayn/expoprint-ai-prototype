import type { LogoCandidate } from "@/lib/analyzeWebsiteResponse";
import { enrichLogoCandidatesTransparency } from "@/lib/server/enrichLogoCandidateTransparency";
import { probeLogoCandidateFetch } from "@/lib/server/probeLogoCandidateFetch";
import {
  filterLogoCandidatesForDesignUi,
  sortLogoCandidatesByScore,
  type LogoRankingContext,
  type ScoredLogoCandidate,
} from "@/lib/logoCandidateRanking";

async function attachPreviewProbes(
  candidates: ScoredLogoCandidate[],
  maxProbes: number,
): Promise<ScoredLogoCandidate[]> {
  const slice = candidates.slice(0, maxProbes);
  const probed = await Promise.all(
    slice.map(async (c) => ({
      ...c,
      previewFetch: await probeLogoCandidateFetch(c.url),
    })),
  );
  const rest = candidates.slice(maxProbes).map((c) => ({ ...c }));
  const merged = [...probed, ...rest];

  const anyAccepted = probed.some((c) => c.previewFetch?.accepted);
  if (!anyAccepted) {
    return merged;
  }

  return [...merged].sort((a, b) => {
    const aOk = a.previewFetch?.accepted ? 1 : 0;
    const bOk = b.previewFetch?.accepted ? 1 : 0;
    if (bOk !== aOk) return bOk - aOk;
    return (b.score ?? 0) - (a.score ?? 0);
  });
}

/**
 * Rank, probe upstream image types, enrich transparency, and cap for the review grid.
 */
export async function prepareLogoCandidatesForUi(
  candidates: LogoCandidate[],
  maxForUi = 6,
  ctx: LogoRankingContext = { brandTokens: [] },
): Promise<LogoCandidate[]> {
  if (candidates.length === 0) return [];
  const sorted = sortLogoCandidatesByScore(candidates, ctx);
  const probed = await attachPreviewProbes(sorted, maxForUi * 2);
  const enriched = await enrichLogoCandidatesTransparency(probed, maxForUi * 2);
  const filtered = filterLogoCandidatesForDesignUi(
    enriched as ScoredLogoCandidate[],
    ctx,
    maxForUi,
  );
  return filtered;
}
