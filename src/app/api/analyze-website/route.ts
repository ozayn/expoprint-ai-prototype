import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { AnalyzeWebsiteApiFailure, AnalyzeWebsiteApiSuccess } from "@/lib/analyzeWebsiteResponse";
import {
  buildExtractedFromPlainValues,
  type ExtractedKey,
} from "@/lib/designIntakeState";

export const runtime = "nodejs";

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

function parseExtractedObjectFromAssistantText(
  text: string,
): Record<string, unknown> | null {
  const root = parseTopLevelJsonObject(text);
  if (!root) return null;
  const inner = root.extracted;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  return root;
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
    return fail(t0, {
      ok: false,
      source: "missing_api_key",
      reason: "missing_api_key",
      claudeAttempted: false,
      model,
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
    };
    devLog("response", errBody);
    return NextResponse.json(errBody, { status: 400 });
  }

  const websiteUrl = asTrimmedString(body.websiteUrl);
  const businessName = asTrimmedString(body.businessName);
  const productCategory = asTrimmedString(body.productCategory);
  const style = asTrimmedString(body.style);
  const specialInstructions = asTrimmedString(body.specialInstructions);

  const userContext = [
    `Business name: ${businessName || "(not provided)"}`,
    `Website URL: ${websiteUrl || "(not provided)"}`,
    `Product category: ${productCategory || "(not provided)"}`,
    `Style preference: ${style || "(not provided)"}`,
    specialInstructions
      ? `Special instructions from user (only factual hints you may reuse verbatim if present):\n${specialInstructions}`
      : "Special instructions: (none)",
  ].join("\n");

  const systemPrompt = `You are helping build a trade-show / tent graphics prototype. The real website is NOT scraped and you have NO HTML or page content — only the structured hints in the user message.

Return STRICT JSON only (no markdown, no commentary). The JSON must be one object with exactly these string fields (use empty string "" when unknown or not clearly provided — do NOT invent plausible phone numbers, emails, street addresses, or social URLs):

${EXTRACTED_JSON_KEYS.map((k) => `"${k}": string`).join(",\n")}

Optional alias: you may also include "colors" as a string; if "brandColors" is empty and "colors" is set, the app maps it to brandColors.

Rules:
- logo: short description of a likely logo treatment or placeholder text; conservative wording.
- brandColors: suggest palette as hex names or short labels if appropriate; otherwise "".
- phone, email, address: ONLY if explicitly present in special instructions or clearly derivable from provided text. Otherwise "".
- social: only real-looking handles/URLs if provided in inputs; else "" or generic empty.
- services, products: short plausible lists inferred only from business name, category, style, and instructions — label as prototype suggestions, not facts.
- Do not claim data was scraped or verified.`;

  const client = new Anthropic({ apiKey });

  try {
    devLog("claude_attempt", { model });

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
      });
    }

    const extractedRaw = parseExtractedObjectFromAssistantText(combinedText);
    if (!extractedRaw) {
      return fail(t0, {
        ok: false,
        source: "invalid_json",
        reason: "invalid_model_json",
        claudeAttempted: true,
        model,
      });
    }

    const rows = buildExtractedFromPlainValues(extractedRaw);

    return okClaude(t0, {
      ok: true,
      source: "claude",
      extracted: rows,
      claudeAttempted: true,
      model,
    });
  } catch {
    return fail(t0, {
      ok: false,
      source: "api_error",
      reason: "api_error",
      claudeAttempted: true,
      model,
    });
  }
}
