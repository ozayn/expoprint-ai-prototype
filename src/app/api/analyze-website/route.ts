import { NextResponse } from "next/server";
import type {
  AnalyzeWebsiteApiFailure,
  AnalyzeWebsiteApiSuccess,
} from "@/lib/analyzeWebsiteResponse";
import { runClaudeWebsiteAnalyze } from "@/lib/server/claudeWebsiteAnalyze";

export const runtime = "nodejs";

/** Vercel serverless: allow multi-page fetch + Claude (see `vercel.json`). */
export const maxDuration = 60;

type AnalyzeBody = {
  websiteUrl?: unknown;
  businessName?: unknown;
  productCategory?: unknown;
  style?: unknown;
  specialInstructions?: unknown;
};

function asTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function devLog(event: string, meta: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.info(`[analyze-website] ${event}`, meta);
  }
}

function fail(
  t0: number,
  payload: Omit<AnalyzeWebsiteApiFailure, "durationMs">,
): NextResponse {
  const body: AnalyzeWebsiteApiFailure = {
    ...payload,
    durationMs: Date.now() - t0,
  };
  devLog("response", {
    ok: body.ok,
    source: body.source,
    reason: body.reason,
    model: body.model,
    claudeAttempted: body.claudeAttempted,
    durationMs: body.durationMs,
    websiteFetchStatus: body.websiteFetch?.status,
  });
  return NextResponse.json(body, { status: 200 });
}

function okClaude(
  t0: number,
  payload: Omit<AnalyzeWebsiteApiSuccess, "durationMs">,
): NextResponse {
  const body: AnalyzeWebsiteApiSuccess = {
    ...payload,
    durationMs: Date.now() - t0,
  };
  devLog("response", {
    ok: body.ok,
    source: body.source,
    model: body.model,
    claudeAttempted: body.claudeAttempted,
    durationMs: body.durationMs,
    websiteFetchStatus: body.websiteFetch.status,
  });
  return NextResponse.json(body, { status: 200 });
}

export async function POST(req: Request) {
  const t0 = Date.now();
  const model =
    process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-sonnet-latest";

  devLog("start", {
    hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    model,
  });

  let body: AnalyzeBody;
  try {
    body = (await req.json()) as AnalyzeBody;
  } catch {
    const errBody = {
      ok: false as const,
      source: "invalid_json" as const,
      reason: "invalid_json_body",
      claudeAttempted: false,
      durationMs: Date.now() - t0,
      model,
      websiteFetch: {
        status: "skipped" as const,
        reason: "invalid_json_body",
      },
    };
    devLog("response", {
      ok: errBody.ok,
      source: errBody.source,
      reason: errBody.reason,
      websiteFetchStatus: errBody.websiteFetch.status,
    });
    return NextResponse.json(errBody, { status: 400 });
  }

  // Shared scrape + Claude pipeline; this route only maps to UI-oriented analyze JSON.
  const result = await runClaudeWebsiteAnalyze({
    websiteUrl: asTrimmedString(body.websiteUrl),
    businessName: asTrimmedString(body.businessName),
    productCategory: asTrimmedString(body.productCategory),
    stylePreference: asTrimmedString(body.style),
    customerInstructions: asTrimmedString(body.specialInstructions),
  });

  if (result.ok) {
    return okClaude(t0, {
      ok: true,
      source: "claude",
      extracted: result.extracted,
      suggestedBusinessName: result.suggestedBusinessName,
      suggestedWebsiteDomain: result.suggestedWebsiteDomain,
      suggestedCanonicalWebsiteUrl: result.suggestedCanonicalWebsiteUrl,
      claudeAttempted: true,
      model: result.model,
      websiteFetch: result.websiteFetch,
    });
  }

  return fail(t0, {
    ok: false,
    source: result.source,
    reason: result.reason,
    claudeAttempted: result.claudeAttempted,
    model: result.model,
    websiteFetch: result.websiteFetch,
    suggestedBusinessName: result.suggestedBusinessName,
    suggestedWebsiteDomain: result.suggestedWebsiteDomain,
    suggestedCanonicalWebsiteUrl: result.suggestedCanonicalWebsiteUrl,
  });
}
