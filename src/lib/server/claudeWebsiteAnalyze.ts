import Anthropic from "@anthropic-ai/sdk";
import type { WebsiteFetchMeta } from "@/lib/analyzeWebsiteResponse";
import { syncWebsiteTypographyMetaCounts } from "@/lib/typographySignals";
import {
  buildExtractedFromPlainValues,
  type ExtractedKey,
} from "@/lib/designIntakeState";
import {
  extractWebsiteContent,
  formatWebsiteContextForClaude,
  normalizePublicWebsiteUrlForIntake,
  type WebsiteContentExtraction,
} from "@/lib/server/extractWebsiteContent";

export type ClaudeAnalyzeSource =
  | "claude"
  | "missing_api_key"
  | "api_error"
  | "invalid_json";

export type ClaudeWebsiteAnalyzeInput = {
  websiteUrl: string;
  businessName?: string;
  productCategory?: string;
  stylePreference?: string;
  customerInstructions?: string;
};

export type ClaudeWebsiteAnalyzeSuccess = {
  ok: true;
  source: "claude";
  extracted: ReturnType<typeof buildExtractedFromPlainValues>;
  suggestedBusinessName: string;
  suggestedWebsiteDomain: string;
  suggestedCanonicalWebsiteUrl: string;
  model: string;
  claudeAttempted: true;
  websiteFetch: WebsiteFetchMeta;
  extraction: WebsiteContentExtraction;
};

export type ClaudeWebsiteAnalyzeFailure = {
  ok: false;
  source: ClaudeAnalyzeSource;
  reason?: string;
  model: string;
  claudeAttempted: boolean;
  websiteFetch: WebsiteFetchMeta;
  extraction: WebsiteContentExtraction;
};

export type ClaudeWebsiteAnalyzeResult =
  | ClaudeWebsiteAnalyzeSuccess
  | ClaudeWebsiteAnalyzeFailure;

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

const ROOT_META_KEYS = new Set([
  "extracted",
  "suggestedBusinessName",
  "suggestedWebsiteDomain",
  "suggestedCanonicalWebsiteUrl",
]);

function businessNameForClaudePrompt(raw: string): string {
  const t = raw.trim();
  return t ? t : "(not provided)";
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

function clampSuggestionStr(v: unknown, maxLen: number): string {
  if (typeof v !== "string") return "";
  const t = v.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

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

function parseClaudeAnalyzeAssistantJson(text: string): {
  extractedPlain: Record<string, unknown>;
  suggestedBusinessName: string;
  suggestedWebsiteDomainClaude: string;
} | null {
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

function buildClaudeSystemPrompt(): string {
  return `You are helping build a trade-show / tent graphics prototype.

The user message may include a **bounded website content block** from the server: a homepage fetch plus up to three additional same-origin pages (about / services / contact-style links only — no full-site crawl, no headless browser). The block includes titles, meta descriptions, open-graph fields, deduped mailto/tel/social links, logo image URL candidates, typography/font-family signals (when detected), and truncated visible-text excerpts per page (total size capped). When the block says the fetch succeeded, you may use it to fill the JSON fields where it clearly applies. When the fetch failed or was skipped, rely on the structured intake lines only.

Intake business name line:
- If **Business name:** in the user message is exactly \`(not provided)\` (no other text on that line), the user left the name empty — infer \`suggestedBusinessName\` from the homepage title, og:title, URL domain (registrable label), logo-related alt text or captions if they appear in the excerpt, or other visible branding text only when clearly supported.
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
- Do not claim the full site was crawled; at most one homepage plus a few same-origin links were fetched.

Output discipline (services / products specifically):
- Prefer pulling phrases from headings, hero text, "What we do" / "Our services" / "Products" sections.
- Reject bullet residue, JSON keys, code, numbers without context, and cookie / cart / login text.
- If only marketing fluff is available, return \`""\` rather than fabricate a list.

Typography (when the website block includes a typography section):
- Font hints come from inline styles, style blocks, CSS variables, and Google Fonts links — not downloaded font files.
- Infer cautious brand typography tone only; do not invent exact unavailable font names in extracted strings; do not add new JSON fields for fonts.`;
}

function normalizeWebsiteFetchMeta(meta: WebsiteFetchMeta): WebsiteFetchMeta {
  const typography = meta.typography;
  if (!typography) return meta;
  return {
    ...meta,
    typography: syncWebsiteTypographyMetaCounts(typography),
  };
}

/**
 * Bounded website scrape + optional Claude structured extraction.
 * Shared by the UI analyze route and the integration extract API.
 */
export async function runClaudeWebsiteAnalyze(
  input: ClaudeWebsiteAnalyzeInput,
): Promise<ClaudeWebsiteAnalyzeResult> {
  const model =
    process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-sonnet-latest";
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  const extraction = await extractWebsiteContent(input.websiteUrl);
  const websiteFetch = normalizeWebsiteFetchMeta(extraction.meta);

  if (!apiKey) {
    return {
      ok: false,
      source: "missing_api_key",
      reason: "missing_api_key",
      model,
      claudeAttempted: false,
      websiteFetch,
      extraction,
    };
  }

  const userContext = [
    `Business name: ${businessNameForClaudePrompt(input.businessName ?? "")}`,
    `Website URL: ${input.websiteUrl || "(not provided)"}`,
    `Product category: ${input.productCategory || "(not provided)"}`,
    `Style preference: ${input.stylePreference || "(not provided)"}`,
    input.customerInstructions
      ? `Special instructions from customer (only factual hints you may reuse verbatim if present):\n${input.customerInstructions}`
      : "Special instructions: (none)",
    "",
    formatWebsiteContextForClaude(extraction),
  ].join("\n");

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model,
      max_tokens: 2048,
      system: buildClaudeSystemPrompt(),
      messages: [
        {
          role: "user",
          content: `Produce the JSON object now.\n\n${userContext}`,
        },
      ],
    });

    const combinedText = assistantTextFromMessage(message);
    if (!combinedText) {
      return {
        ok: false,
        source: "invalid_json",
        reason: "empty_model_response",
        model,
        claudeAttempted: true,
        websiteFetch,
        extraction,
      };
    }

    const parsed = parseClaudeAnalyzeAssistantJson(combinedText);
    if (!parsed) {
      return {
        ok: false,
        source: "invalid_json",
        reason: "invalid_model_json",
        model,
        claudeAttempted: true,
        websiteFetch,
        extraction,
      };
    }

    const rows = buildExtractedFromPlainValues(parsed.extractedPlain);
    const { canonical: canonicalHint, domain: domainFromUrl } = buildPublicUrlHints(
      input.websiteUrl,
      websiteFetch,
    );
    const mergedDomain =
      domainFromUrl || parsed.suggestedWebsiteDomainClaude || "";

    return {
      ok: true,
      source: "claude",
      extracted: rows,
      suggestedBusinessName: parsed.suggestedBusinessName,
      suggestedWebsiteDomain: mergedDomain,
      suggestedCanonicalWebsiteUrl: canonicalHint,
      model,
      claudeAttempted: true,
      websiteFetch,
      extraction,
    };
  } catch {
    return {
      ok: false,
      source: "api_error",
      reason: "api_error",
      model,
      claudeAttempted: true,
      websiteFetch,
      extraction,
    };
  }
}
