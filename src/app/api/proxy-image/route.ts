import { lookup as dnsLookup } from "node:dns/promises";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const FETCH_TIMEOUT_MS = 6_000;
/** 2 MiB upper bound for proxied logo bytes — generous for SVG/PNG/JPEG marks. */
const MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED_MIME = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/avif",
]);

const USER_AGENT =
  "ExpoPrintAI-Prototype/1.0 (+https://github.com/ozayn/expoprint-ai-prototype)";

const CACHE_CONTROL = "public, max-age=3600, s-maxage=3600";

function devLog(event: string, meta: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    /** Avoid logging full URL: only the host + outcome are useful for debugging. */
    console.info(`[proxy-image] ${event}`, meta);
  }
}

/** Block well-known unroutable / private / loopback ranges to mitigate SSRF. */
function isPrivateOrSpecialIp(ip: string, family: 4 | 6): boolean {
  if (family === 4) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts as [number, number, number, number];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  /** v6: be conservative — block loopback, link-local, ULA, mapped v4. */
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice("::ffff:".length);
    /** Use v4 rules for tunneled v4. */
    return isPrivateOrSpecialIp(v4, 4);
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

function bad(status: number, reason: string, hostHint?: string): NextResponse {
  devLog("reject", { status, reason, host: hostHint });
  return new NextResponse(reason, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function readBodyWithLimit(
  res: Response,
  limitBytes: number,
): Promise<ArrayBuffer | "too_large"> {
  if (!res.body) {
    /** No streaming body — fall back to arrayBuffer with size guard. */
    const buf = await res.arrayBuffer();
    if (buf.byteLength > limitBytes) return "too_large";
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > limitBytes) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        return "too_large";
      }
      chunks.push(value);
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}

/**
 * Same-origin image proxy for logo candidates surfaced by Analyze Website.
 *
 * Hard requirements (all enforced before any upstream byte is read):
 * - Only `http:` / `https:` URLs.
 * - Hostname must resolve to a public IP (no localhost, no RFC1918, etc.).
 * - Per-request abort timeout.
 * - Body size hard cap (~2 MiB).
 * - Upstream `Content-Type` must be in a small image whitelist.
 *
 * Returns:
 * - 400 — missing/invalid `url` or unsupported scheme.
 * - 403 — host resolves to private/loopback or fails DNS.
 * - 415 — upstream content-type not allowed.
 * - 502 — upstream HTTP error.
 * - 504 — fetch timed out.
 * - 413 — upstream body exceeded cap.
 * - 200 — image bytes with original `Content-Type`, public cache, and CORS open.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = url.searchParams.get("url");
  if (!target) return bad(400, "missing_url");

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return bad(400, "invalid_url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return bad(400, "scheme_not_allowed");
  }
  /** No userinfo in URL (CVE-style proxy abuse). */
  if (parsed.username || parsed.password) {
    return bad(400, "userinfo_not_allowed", parsed.hostname);
  }

  const hostname = parsed.hostname;
  if (!hostname) return bad(400, "missing_host");
  if (!(await hostResolvesToPublicIp(hostname))) {
    return bad(403, "private_or_unresolvable_host", hostname);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let upstream: Response;
  try {
    upstream = await fetch(parsed.href, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,image/avif,image/*;q=0.8",
      },
    });
  } catch (err) {
    clearTimeout(timer);
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? "timeout"
        : "fetch_error";
    return bad(reason === "timeout" ? 504 : 502, reason, hostname);
  }
  clearTimeout(timer);

  if (!upstream.ok) {
    return bad(502, `upstream_${upstream.status}`, hostname);
  }

  const rawType = (upstream.headers.get("content-type") ?? "").trim();
  const baseType = rawType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (!ALLOWED_MIME.has(baseType)) {
    return bad(415, `unsupported_type:${baseType || "unknown"}`, hostname);
  }

  /** Pre-flight content-length check; final cap enforced while streaming. */
  const cl = upstream.headers.get("content-length");
  if (cl) {
    const n = Number(cl);
    if (Number.isFinite(n) && n > MAX_BYTES) {
      return bad(413, "body_too_large", hostname);
    }
  }

  const body = await readBodyWithLimit(upstream, MAX_BYTES);
  if (body === "too_large") {
    return bad(413, "body_too_large", hostname);
  }

  devLog("ok", {
    host: hostname,
    type: baseType,
    bytes: body.byteLength,
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": rawType || baseType,
      "Cache-Control": CACHE_CONTROL,
      /**
       * Open CORS so Fabric can load this with `crossOrigin: "anonymous"` and
       * keep the canvas un-tainted for PNG export. The proxy never returns
       * arbitrary bytes; the upstream content type is whitelisted above.
       */
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

/** Permit OPTIONS preflight if any client ever issues one (browsers usually skip simple GET image fetches). */
export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
    },
  });
}
