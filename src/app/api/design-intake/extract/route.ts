import { NextResponse } from "next/server";
import { buildDesignIntakeExtractResponse } from "@/lib/buildDesignIntakeApiResponse";
import { parseDesignIntakeExtractRequest } from "@/lib/designIntakeApiSchema";
import { runClaudeWebsiteAnalyze } from "@/lib/server/claudeWebsiteAnalyze";

export const runtime = "nodejs";

/** Same budget as analyze-website: multi-page fetch + Claude. */
export const maxDuration = 60;

function devLog(event: string, meta: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.info(`[design-intake/extract] ${event}`, meta);
  }
}

export async function POST(req: Request) {
  const t0 = Date.now();

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    devLog("response", { ok: false, reason: "invalid_json_body" });
    return NextResponse.json(
      {
        ok: false,
        reason: "invalid_json_body",
        metadata: {
          source: "scraper_only",
          pagesInspected: 0,
          durationMs: Date.now() - t0,
          websiteFetch: { status: "skipped", reason: "invalid_json_body" },
          claude: { attempted: false, model: "", status: "skipped" },
          warnings: ["Invalid JSON request body."],
        },
      },
      { status: 400 },
    );
  }

  const parsed = parseDesignIntakeExtractRequest(raw);
  if (!parsed.ok) {
    devLog("response", { ok: false, reason: parsed.reason });
    return NextResponse.json(
      {
        ok: false,
        reason: parsed.reason,
        metadata: {
          source: "scraper_only",
          pagesInspected: 0,
          durationMs: Date.now() - t0,
          websiteFetch: {
            status: "skipped",
            reason: parsed.reason,
          },
          claude: { attempted: false, model: "", status: "skipped" },
          warnings: [
            parsed.reason === "websiteUrl_required"
              ? "websiteUrl is required."
              : "Invalid request body.",
          ],
        },
      },
      { status: 400 },
    );
  }

  const { body } = parsed;

  const pipeline = await runClaudeWebsiteAnalyze({
    websiteUrl: body.websiteUrl,
    productCategory: body.productCategory,
    stylePreference: body.stylePreference,
    customerInstructions: body.customerInstructions,
  });

  const response = buildDesignIntakeExtractResponse(
    body,
    pipeline,
    Date.now() - t0,
  );

  devLog("response", {
    ok: response.ok,
    source: response.metadata.source,
    pagesInspected: response.metadata.pagesInspected,
    claudeStatus: response.metadata.claude.status,
    warningCount: response.metadata.warnings.length,
    durationMs: response.metadata.durationMs,
  });

  return NextResponse.json(response, { status: 200 });
}
