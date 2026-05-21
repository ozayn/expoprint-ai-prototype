import type { WebsiteFetchMeta } from "@/lib/analyzeWebsiteResponse";

/** Machine-readable warning when the static scraper is denied (403, etc.). */
export const SITE_BLOCKED_STATIC_FETCH_CODE = "site_blocked_static_fetch";

export const SITE_BLOCKED_STATIC_FETCH_MESSAGE =
  "Website blocked static extraction; manual review or customer-provided assets may be needed.";

export const CUSTOMER_PROVIDED_LOGO_ASSET =
  "Customer-provided logo/brand assets recommended";

export const MANUAL_SERVICES_CONFIRM_ASSET =
  "Manual services/products confirmation recommended";

/** HTTP status reasons from `extractWebsiteContent` that indicate bot/WAF blocks. */
const BLOCKED_HTTP_REASON_RE = /^http_(403|401|429|451|405)$/;

/**
 * True when the homepage fetch failed with an access-denied style HTTP code.
 * Does not attempt bypass — callers should surface manual/customer asset guidance.
 */
export function isStaticFetchBlocked(meta: WebsiteFetchMeta): boolean {
  if (meta.status !== "failed") return false;
  const reason = (meta.reason ?? "").trim();
  return BLOCKED_HTTP_REASON_RE.test(reason);
}
