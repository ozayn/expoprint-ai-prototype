import { hasOfferingsForRow } from "./offeringsExtractionParse";
import type { ReviewQueueRow } from "./reviewQueueTypes";

export type ParsedLogoCandidate = {
  url: string;
  source?: string;
  logoRole?: string;
};

export type ParsedColorEntry = {
  hex: string;
  label?: string;
};

const HEX_IN_STRING = /#([0-9A-Fa-f]{3,8})\b/;

export function normalizeHex(value: string): string | null {
  const t = value.trim();
  const m = t.match(HEX_IN_STRING);
  if (m) {
    let hex = m[1]!;
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    return `#${hex.toLowerCase()}`;
  }
  if (/^[0-9A-Fa-f]{6}$/.test(t)) return `#${t.toLowerCase()}`;
  return null;
}

export function parseHexListJson(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (typeof item === "string") return normalizeHex(item) ?? item.trim();
        return null;
      })
      .filter((h): h is string => Boolean(h));
  } catch {
    return trimmed
      .split(/[;,|·]+/)
      .map((part) => normalizeHex(part) ?? "")
      .filter(Boolean);
  }
}

export function parseLogoCandidatesJson(raw: string): ParsedLogoCandidate[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return [];

    const out: ParsedLogoCandidate[] = [];
    for (const item of parsed) {
      if (typeof item === "string" && item.trim()) {
        out.push({ url: item.trim() });
        continue;
      }
      if (item && typeof item === "object" && "url" in item) {
        const url = String((item as { url: unknown }).url ?? "").trim();
        if (!url) continue;
        const source =
          "source" in item && typeof (item as { source?: unknown }).source === "string"
            ? (item as { source: string }).source
            : undefined;
        const logoRole =
          "logoRole" in item && typeof (item as { logoRole?: unknown }).logoRole === "string"
            ? (item as { logoRole: string }).logoRole
            : undefined;
        out.push({ url, source, logoRole });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function logoCandidatesForRow(
  row: ReviewQueueRow,
  max = 5,
): ParsedLogoCandidate[] {
  const fromJson = parseLogoCandidatesJson(row.logo_candidate_urls ?? "");
  if (fromJson.length > 0) return fromJson.slice(0, max);

  const selected = row.selected_logo_url?.trim();
  if (selected) return [{ url: selected }];
  return [];
}

export function colorEntriesForRow(row: ReviewQueueRow): ParsedColorEntry[] {
  const hexes = parseHexListJson(row.extracted_color_hexes ?? "");
  const primary = normalizeHex(row.primary_color_hex ?? "");
  const secondary = normalizeHex(row.secondary_color_hex ?? "");

  const entries: ParsedColorEntry[] = [];
  const seen = new Set<string>();

  const push = (hex: string, label?: string) => {
    const normalized = normalizeHex(hex);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    entries.push({ hex: normalized, label });
  };

  if (primary) push(primary, "primary");
  if (secondary) push(secondary, "secondary");

  for (const hex of hexes) {
    push(hex);
  }

  return entries.slice(0, 8);
}

export function proxiedEvalImageSrc(remoteUrl: string): string {
  return `/api/proxy-image?url=${encodeURIComponent(remoteUrl)}`;
}

export type FieldCoverageSummary = {
  sites: number;
  successCount: number;
  namesExtracted: number;
  categoriesExtracted: number;
  logosExtracted: number;
  palettesExtracted: number;
  summariesExtracted: number;
  offeringsExtracted: number;
  errors: number;
};

export function computeFieldCoverageSummary(rows: ReviewQueueRow[]): FieldCoverageSummary {
  let successCount = 0;
  let namesExtracted = 0;
  let categoriesExtracted = 0;
  let logosExtracted = 0;
  let palettesExtracted = 0;
  let summariesExtracted = 0;
  let offeringsExtracted = 0;
  let errors = 0;

  for (const row of rows) {
    const status = row.status?.trim() ?? "";
    if (status === "success") successCount += 1;
    if (isPartialOrFailedStatus(status)) errors += 1;

    if (row.extracted_business_name?.trim()) namesExtracted += 1;
    if (row.extracted_business_category?.trim()) categoriesExtracted += 1;
    if (row.extracted_summary?.trim()) summariesExtracted += 1;
    if (hasOfferingsForRow(row)) offeringsExtracted += 1;
    if (logoCandidatesForRow(row).length > 0) logosExtracted += 1;
    if (colorEntriesForRow(row).length > 0) palettesExtracted += 1;
  }

  return {
    sites: rows.length,
    successCount,
    namesExtracted,
    categoriesExtracted,
    logosExtracted,
    palettesExtracted,
    summariesExtracted,
    offeringsExtracted,
    errors,
  };
}

export function formatFieldCoverageSummary(summary: FieldCoverageSummary): string {
  const parts = [
    `${summary.sites} site${summary.sites === 1 ? "" : "s"}`,
    `${summary.successCount} success`,
    `${summary.namesExtracted} name${summary.namesExtracted === 1 ? "" : "s"}`,
    `${summary.categoriesExtracted} categor${summary.categoriesExtracted === 1 ? "y" : "ies"}`,
    `${summary.logosExtracted} logo${summary.logosExtracted === 1 ? "" : "s"}`,
    `${summary.palettesExtracted} palette${summary.palettesExtracted === 1 ? "" : "s"}`,
    `${summary.summariesExtracted} summar${summary.summariesExtracted === 1 ? "y" : "ies"}`,
    `${summary.offeringsExtracted} offering${summary.offeringsExtracted === 1 ? "" : "s"}`,
    `${summary.errors} error${summary.errors === 1 ? "" : "s"}`,
  ];
  return parts.join(" · ");
}

/** @deprecated Use computeFieldCoverageSummary */
export function computeBrandAuditSummary(rows: ReviewQueueRow[]): {
  sites: number;
  logosExtracted: number;
  palettesExtracted: number;
} {
  const s = computeFieldCoverageSummary(rows);
  return {
    sites: s.sites,
    logosExtracted: s.logosExtracted,
    palettesExtracted: s.palettesExtracted,
  };
}

export function bestLogoForRow(row: ReviewQueueRow): ParsedLogoCandidate | null {
  const candidates = logoCandidatesForRow(row, 5);
  if (candidates.length === 0) return null;

  const selected = row.selected_logo_url?.trim();
  if (selected) {
    const match = candidates.find((c) => c.url.trim() === selected);
    return match ?? { url: selected };
  }
  return candidates[0] ?? null;
}

export function extraLogoCandidateCount(row: ReviewQueueRow): number {
  const parsed = Number.parseInt(row.logo_candidate_count ?? "", 10);
  const fromJson = logoCandidatesForRow(row, 5).length;
  const total = Number.isFinite(parsed) && parsed > 0 ? parsed : fromJson;
  return total > 1 ? total - 1 : 0;
}

export function isPartialOrFailedStatus(status: string): boolean {
  const s = status.trim();
  if (!s || s === "success") return false;
  return true;
}

export function sourceLabelForRow(row: ReviewQueueRow): string {
  const domain = row.domain?.trim() || row.canonical_domain?.trim();
  const url = row.normalized_url?.trim();
  if (domain && url) return domain;
  return domain || url || "—";
}

function pushColorToken(tokens: string[], seen: Set<string>, value: unknown): void {
  if (value == null) return;

  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    tokens.push(t);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) pushColorToken(tokens, seen, item);
    return;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const keyLower = key.toLowerCase();
      if (keyLower === "url" || keyLower.includes("logo")) continue;
      const labeled =
        typeof child === "string" &&
        /primary|secondary|accent|neutral|background|teal|navy/i.test(key)
          ? `${key} ${child}`
          : child;
      pushColorToken(tokens, seen, labeled);
    }
  }
}

/** Collect color tokens from expo_output across known API / alias shapes. */
export function collectColorTokensFromExpo(expo: unknown): string[] {
  if (!expo || typeof expo !== "object") return [];

  const tokens: string[] = [];
  const seen = new Set<string>();
  const root = expo as Record<string, unknown>;

  const brand = root.brand as Record<string, unknown> | undefined;
  if (brand) {
    pushColorToken(tokens, seen, brand.colors);
    pushColorToken(tokens, seen, brand.brandColors);
    pushColorToken(tokens, seen, brand.palette);
    pushColorToken(tokens, seen, brand.primaryColor);
    pushColorToken(tokens, seen, brand.secondaryColor);
    pushColorToken(tokens, seen, brand.accentColor);
    pushColorToken(tokens, seen, brand.extractedColors);
  }

  pushColorToken(tokens, seen, root.colors);
  pushColorToken(tokens, seen, root.brandColors);
  pushColorToken(tokens, seen, root.extractedColors);
  pushColorToken(tokens, seen, root.palette);

  const designSpec = root.designSpec as Record<string, unknown> | undefined;
  if (designSpec) {
    pushColorToken(tokens, seen, designSpec.brandColors);
    pushColorToken(tokens, seen, designSpec.colors);
  }

  const visualIdentity = root.visualIdentity as Record<string, unknown> | undefined;
  if (visualIdentity) {
    pushColorToken(tokens, seen, visualIdentity.colors);
    pushColorToken(tokens, seen, visualIdentity.palette);
  }

  const metadata = root.metadata as Record<string, unknown> | undefined;
  if (metadata) {
    pushColorToken(tokens, seen, metadata.colorBackground);
    pushColorToken(tokens, seen, metadata.colorAccent);
    pushColorToken(tokens, seen, metadata.colorText);
  }

  return tokens;
}

export function brandColorFieldsFromTokens(
  tokens: string[],
): Pick<
  ReviewQueueRow,
  "extracted_color_hexes" | "primary_color_hex" | "secondary_color_hex"
> {
  const hexes: string[] = [];
  let primary = "";
  let secondary = "";

  for (const raw of tokens) {
    const hex = normalizeHex(raw);
    if (!hex) continue;
    if (!hexes.includes(hex)) hexes.push(hex);

    const lower = raw.toLowerCase();
    if (!primary && lower.includes("primary")) primary = hex;
    else if (
      !secondary &&
      (lower.includes("secondary") ||
        lower.includes("accent") ||
        lower.includes("teal") ||
        lower.includes("navy"))
    ) {
      secondary = hex;
    }
  }

  if (!primary && hexes[0]) primary = hexes[0];
  if (!secondary && hexes[1]) secondary = hexes[1];

  return {
    extracted_color_hexes: hexes.length > 0 ? JSON.stringify(hexes.slice(0, 8)) : "",
    primary_color_hex: primary,
    secondary_color_hex: secondary,
  };
}
