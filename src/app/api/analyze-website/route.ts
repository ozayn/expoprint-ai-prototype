import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type {
  AnalyzeWebsiteApiFailure,
  AnalyzeWebsiteApiSuccess,
  WebsiteFetchMeta,
} from "@/lib/analyzeWebsiteResponse";
import {
  buildExtractedFromPlainValues,
  DEFAULT_DEMO_BUSINESS_NAME,
  type ExtractedKey,
} from "@/lib/designIntakeState";
import {
  extractWebsiteContent,
  formatWebsiteContextForClaude,
  normalizePublicWebsiteUrlForIntake,
} from "@/lib/server/extractWebsiteContent";

export const runtime = "nodejs";

/** Vercel serverless: allow multi-page fetch + Claude (see `vercel.json` on `vercel-deploy`). */
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

/** Value shown to Claude only — real request body is unchanged on the wire from the client. */
function businessNameForClaudePrompt(raw: string): string {
  const t = raw.trim();
  if (!t || t === DEFAULT_DEMO_BUSINESS_NAME) {
    return "(not provided)";
  }
  return t;
}

function stripJsonCodeFences(text: string): string {
  const t = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  if (fenced) return fenced[1].trim();
  return t;
}

function parseTopLevelJsonObject(text: string): Record<string, unknown> | null {
  const stripped = stripJsonCodeFences(text.trim());
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  return parsed as Record<string, unknown>;
}

const ROOT_META_KEYS = new Set([
  "extracted",
  "suggestedBusinessName",
  "suggestedWebsiteDomain",
  "suggestedCanonicalWebsiteUrl",
]);

function clampSuggestionStr(v: unknown, maxLen: number): string {
  if (typeof v !== "string") return "";
  const t = v.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

/** Hostname only, lowercased, no leading www; empty if not parseable as a host. */
function hostnameHintFromString(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return "";
  const hostPart = t.replace(/^https?:\/\//, "").split("/")[0]?.split("@").pop();
  if (!hostPart) return "";
  const noPort = hostPart.split(":")[0] ?? "";
  if (!noPort) return "";
  try {
    return new URL(`https://${noPort}`).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function hostnameFromHttpUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function buildPublicUrlHints(
  websiteUrl: string,
  fetchMeta: WebsiteFetchMeta,
): { canonical: string; domain: string } {
  const fromFetch =
    fetchMeta.status === "success" && typeof fetchMeta.finalUrl === "string"
      ? fetchMeta.finalUrl.trim()
      : "";
  const fromInput = normalizePublicWebsiteUrlForIntake(websiteUrl) ?? "";
  const canonical = fromFetch || fromInput;
  const domain = canonical ? hostnameFromHttpUrl(canonical) : "";
  return { canonical, domain };
}

type ParsedClaudeAnalyze = {
  extractedPlain: Record<string, unknown>;
  suggestedBusinessName: string;
  suggestedWebsiteDomainClaude: string;
};

function parseClaudeAnalyzeAssistantJson(text: string): ParsedClaudeAnalyze | null {
  const root = parseTopLevelJsonObject(text);
  if (!root) return null;

  const suggestedBusinessName = clampSuggestionStr(root.suggestedBusinessName, 200);
  const suggestedWebsiteDomainClaude = hostnameHintFromString(
    clampSuggestionStr(root.suggestedWebsiteDomain, 253),
  );

  const inner = root.extracted;
  let extractedPlain: Record<string, unknown>;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    extractedPlain = inner as Record<string, unknown>;
  } else {
    extractedPlain = { ...root };
    for (const k of ROOT_META_KEYS) {
      delete extractedPlain[k];
    }
  }

  return {
    extractedPlain,
    suggestedBusinessName,
    suggestedWebsiteDomainClaude,
  };
}

function assistantTextFromMessage(message: Anthropic.Messages.Message): string {
  const parts: string[] = [];
  for (const block of message.content) {
    if (block.type === "text") {
      parts.push(block.text);
    }
  }
  return parts.join("\n").trim();
}

const EXTRACTED_JSON_KEYS = [
  "logo",
  "brandColors",
  "phone",
  "email",
  "address",
  "social",
  "services",
  "products",
] as const satisfies readonly ExtractedKey[];

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
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  const hasApiKey = Boolean(apiKey);

  devLog("start", {
    hasApiKey,
    model,
  });

  if (!apiKey) {
    const websiteFetch: WebsiteFetchMeta = {
      status: "skipped",
      reason: "missing_api_key",
    };
    return fail(t0, {
      ok: false,
      source: "missing_api_key",
      reason: "missing_api_key",
      claudeAttempted: false,
      model,
      websiteFetch,
    });
  }

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
      } satisfies WebsiteFetchMeta,
    };
    devLog("response", {
      ok: errBody.ok,
      source: errBody.source,
      reason: errBody.reason,
      websiteFetchStatus: errBody.websiteFetch.status,
    });
    return NextResponse.json(errBody, { status: 400 });
  }

  const websiteUrl = asTrimmedString(body.websiteUrl);
  const businessName = asTrimmedString(body.businessName);
  const productCategory = asTrimmedString(body.productCategory);
  const style = asTrimmedString(body.style);
  const specialInstructions = asTrimmedString(body.specialInstructions);

  const extraction = await extractWebsiteContent(websiteUrl);
  const websiteFetch: WebsiteFetchMeta = extraction.meta;

  const businessNameClaudeLine = businessNameForClaudePrompt(businessName);

  const userContext = [
    `Business name: ${businessNameClaudeLine}`,
    `Website URL: ${websiteUrl || "(not provided)"}`,
    `Product category: ${productCategory || "(not provided)"}`,
    `Style preference: ${style || "(not provided)"}`,
    specialInstructions
      ? `Special instructions from user (only factual hints you may reuse verbatim if present):\n${specialInstructions}`
      : "Special instructions: (none)",
    "",
    formatWebsiteContextForClaude(extraction),
  ].join("\n");

  const systemPrompt = `You are helping build a trade-show / tent graphics prototype.

The user message may include a **bounded website content block** from the server: a homepage fetch plus up to three additional same-origin pages (about / services / contact-style links only — no full-site crawl, no headless browser). The block includes titles, meta descriptions, open-graph fields, deduped mailto/tel/social links, logo image URL candidates, and truncated visible-text excerpts per page (total size capped). When the block says the fetch succeeded, you may use it to fill the JSON fields where it clearly applies. When the fetch failed or was skipped, rely on the structured intake lines only.

Intake business name line:
- If **Business name:** in the user message is exactly \`(not provided)\` (no other text on that line), the user left the name empty **or** it is only the app's demo placeholder — **treat as no user-provided business name**. Do **not** echo any demo placeholder into \`suggestedBusinessName\`. Infer \`suggestedBusinessName\` from the homepage title, og:title, URL domain (registrable label), logo-related alt text or captions if they appear in the excerpt, or other visible branding text only when clearly supported.
- If **Business name:** is any other non-empty string, treat it as the user's stated business name for weak corroboration only; still prefer the public identity implied by the homepage when they clearly conflict, and never invent a name.

You must return STRICT JSON only (no markdown, no commentary). The JSON must be one object with:

1) "extracted": an object whose string fields are (use "" when unknown — do NOT invent plausible phone numbers, emails, or street addresses):

${EXTRACTED_JSON_KEYS.map((k) => `    "${k}": string`).join(",\n")}

Inside "extracted", optional alias: you may also include "colors" as a string; if "brandColors" is empty and "colors" is set, the app maps it to brandColors.

2) Top-level string fields (same object, alongside "extracted"):
- "suggestedBusinessName": public company or site name inferred from the homepage block and URL when the business name line was \`(not provided)\`, or reconciled with the user's stated name when provided. Use "" if uncertain or unsupported — do NOT invent a plausible business name.
- "suggestedWebsiteDomain": hostname only when clear (e.g. "example.com"), else "". No scheme, no path.

Rules for "extracted":
- logo: short description only; never invent or guess a logo URL. The server may have collected candidate image URLs (icon / apple-touch-icon / og:image / logo-class img / header img) and exposes them to the UI for human review — you do not need to repeat URLs.
- brandColors: hex or labels if suggested by page or intake; otherwise "".
- phone, email, address: ONLY from visible text, mailto/tel links, or user special instructions — not guessed.
- social: prefer real URLs/handles found in the homepage block or user input.
- services, products: a single readable line, **comma-separated** (or semicolons), e.g. \`"Custom canopy tents, branded backdrops, event flags"\`. **Do NOT include** broken fragments, isolated punctuation, repeated commas, empty parentheses (\`()\`), partial words, navigation labels (\`Home\`, \`Menu\`), or raw text dumps from the page. Each item must be a real phrase of at least 3 letters or a clearly meaningful size token (e.g. \`10x10\`). Limit to **at most ~6 items** per field. If the source pages do not clearly describe services / products in print-ready phrasing, return \`""\` instead of guessing.
- Do not claim the full site was crawled; at most one homepage plus a few same-domain links were fetched.

Output discipline (services / products specifically):
- Prefer pulling phrases from headings, hero text, "What we do" / "Our services" / "Products" sections.
- Reject bullet residue, JSON keys, code, numbers without context, and cookie / cart / login text.
- If only marketing fluff is available, return \`""\` rather than fabricate a list.`;

  const client = new Anthropic({ apiKey });

  try {
    devLog("claude_attempt", { model, websiteFetchStatus: websiteFetch.status });

    const message = await client.messages.create({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Produce the JSON object now.\n\n${userContext}`,
        },
      ],
    });

    const combinedText = assistantTextFromMessage(message);
    if (!combinedText) {
      return fail(t0, {
        ok: false,
        source: "invalid_json",
        reason: "empty_model_response",
        claudeAttempted: true,
        model,
        websiteFetch,
      });
    }

    const parsed = parseClaudeAnalyzeAssistantJson(combinedText);
    if (!parsed) {
      return fail(t0, {
        ok: false,
        source: "invalid_json",
        reason: "invalid_model_json",
        claudeAttempted: true,
        model,
        websiteFetch,
      });
    }

    const rows = buildExtractedFromPlainValues(parsed.extractedPlain);

    const { canonical: canonicalHint, domain: domainFromUrl } = buildPublicUrlHints(
      websiteUrl,
      websiteFetch,
    );
    const mergedDomain =
      domainFromUrl || parsed.suggestedWebsiteDomainClaude || "";

    return okClaude(t0, {
      ok: true,
      source: "claude",
      extracted: rows,
      suggestedBusinessName: parsed.suggestedBusinessName,
      suggestedWebsiteDomain: mergedDomain,
      suggestedCanonicalWebsiteUrl: canonicalHint,
      claudeAttempted: true,
      model,
      websiteFetch,
    });
  } catch {
    return fail(t0, {
      ok: false,
      source: "api_error",
      reason: "api_error",
      claudeAttempted: true,
      model,
      websiteFetch,
    });
  }
}
