import { lookup as dnsLookup } from "node:dns/promises";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 2 * 1024 * 1024;
const USER_AGENT =
  "ExpoPrintAI-Prototype/1.0 (+https://github.com/ozayn/expoprint-ai-prototype)";

const BLOCKED_PROTOCOL = /^(javascript|data|vbscript|file|mailto):/i;

function isPrivateOrSpecialIp(ip: string, family: 4 | 6): boolean {
  if (family === 4) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts as [number, number, number, number];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("::ffff:")) {
    return isPrivateOrSpecialIp(lower.slice("::ffff:".length), 4);
  }
  return false;
}

async function hostResolvesToPublicIp(hostname: string): Promise<boolean> {
  const lower = hostname.toLowerCase();
  if (
    lower === "localhost" ||
    lower === "ip6-localhost" ||
    lower === "ip6-loopback"
  ) {
    return false;
  }
  try {
    const records = await dnsLookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) return false;
    for (const r of records) {
      if (isPrivateOrSpecialIp(r.address, r.family as 4 | 6)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function safeHttpImageUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || BLOCKED_PROTOCOL.test(trimmed)) return null;
  try {
    const withScheme = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed.replace(/^\/+/, "")}`;
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.hostname) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

async function readBodyWithLimit(res: Response, limitBytes: number): Promise<Buffer | null> {
  if (!res.body) {
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length <= limitBytes ? buf : null;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.length;
    if (total > limitBytes) return null;
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

/** Fetch image bytes from a public http(s) URL (SSRF-safe). */
export async function fetchImageBytesSafe(url: string): Promise<Buffer | null> {
  const href = safeHttpImageUrl(url);
  if (!href) return null;

  const hostname = new URL(href).hostname;
  if (!(await hostResolvesToPublicIp(hostname))) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(href, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "image/*,*/*;q=0.8" },
      redirect: "follow",
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      contentType &&
      !contentType.startsWith("image/") &&
      contentType !== "application/octet-stream"
    ) {
      return null;
    }

    return await readBodyWithLimit(res, MAX_BYTES);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
