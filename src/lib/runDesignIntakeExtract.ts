import { buildDesignIntakeExtractResponse } from "@/lib/buildDesignIntakeApiResponse";
import type {
  DesignIntakeExtractRequest,
  DesignIntakeExtractResponse,
} from "@/lib/designIntakeApiSchema";
import { runClaudeWebsiteAnalyze } from "@/lib/server/claudeWebsiteAnalyze";

export type RunDesignIntakeExtractResult = {
  response: DesignIntakeExtractResponse;
  durationMs: number;
};

/**
 * Shared design-intake extraction pipeline (scrape + optional Claude + integration JSON).
 * Used by `POST /api/design-intake/extract` and available for internal eval tooling.
 */
export async function runDesignIntakeExtract(
  request: DesignIntakeExtractRequest,
): Promise<RunDesignIntakeExtractResult> {
  const t0 = Date.now();

  const pipeline = await runClaudeWebsiteAnalyze({
    websiteUrl: request.websiteUrl,
    productCategory: request.productCategory,
    stylePreference: request.stylePreference,
    customerInstructions: request.customerInstructions,
  });

  const response = buildDesignIntakeExtractResponse(
    request,
    pipeline,
    Date.now() - t0,
  );

  return { response, durationMs: Date.now() - t0 };
}
