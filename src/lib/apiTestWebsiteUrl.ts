/** Helper copy for /api-test and /api-docs URL fields. */
export const API_TEST_WEBSITE_URL_HELPER =
  "You can enter a domain like expoprint.io; the tool will use https:// by default.";

export const API_TEST_WEBSITE_URL_EMPTY_MESSAGE =
  "Enter a website URL or domain.";

/**
 * Normalize user-entered website input for API test/docs forms only.
 * Trims whitespace and prepends https:// when no scheme is present.
 */
export function normalizeApiTestWebsiteUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}
