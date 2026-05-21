const PROBE_TIMEOUT_MS = 4_000;
const SNIFF_BYTES = 512;

const ALLOWED_IMAGE_MIME = new Set([
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

export type LogoCandidatePreviewFetch = {
  accepted: boolean;
  contentType: string;
  reason?: string;
};

function baseMime(raw: string): string {
  return raw.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function looksLikeHtmlBody(buf: Uint8Array): boolean {
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(buf.slice(0, Math.min(buf.length, SNIFF_BYTES)))
    .trimStart()
    .toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html") || head.startsWith("<?xml");
}

/**
 * Lightweight upstream check (HEAD, then tiny GET sniff) — same image whitelist as `/api/proxy-image`.
 */
export async function probeLogoCandidateFetch(
  url: string,
): Promise<LogoCandidatePreviewFetch> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const head = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,image/avif,image/*;q=0.8",
      },
    });
    clearTimeout(timer);

    if (!head.ok) {
      return {
        accepted: false,
        contentType: baseMime(head.headers.get("content-type") ?? ""),
        reason: `upstream_${head.status}`,
      };
    }

    const contentType = baseMime(head.headers.get("content-type") ?? "");
    if (!ALLOWED_IMAGE_MIME.has(contentType)) {
      return {
        accepted: false,
        contentType: contentType || "unknown",
        reason: `unsupported_type:${contentType || "unknown"}`,
      };
    }

    if (contentType === "image/png" || contentType === "image/jpeg" || contentType === "image/webp") {
      const sniffController = new AbortController();
      const sniffTimer = setTimeout(() => sniffController.abort(), PROBE_TIMEOUT_MS);
      try {
        const get = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: sniffController.signal,
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "image/*",
            Range: "bytes=0-511",
          },
        });
        clearTimeout(sniffTimer);
        if (get.ok && get.body) {
          const reader = get.body.getReader();
          const chunk = await reader.read();
          try {
            await reader.cancel();
          } catch {
            /* ignore */
          }
          if (chunk.value && looksLikeHtmlBody(chunk.value)) {
            return {
              accepted: false,
              contentType: "text/html",
              reason: "unsupported_type:text/html",
            };
          }
        }
      } catch {
        clearTimeout(sniffTimer);
      }
    }

    return { accepted: true, contentType };
  } catch (err) {
    clearTimeout(timer);
    const reason =
      err instanceof Error && err.name === "AbortError" ? "timeout" : "fetch_error";
    return { accepted: false, contentType: "unknown", reason };
  }
}
