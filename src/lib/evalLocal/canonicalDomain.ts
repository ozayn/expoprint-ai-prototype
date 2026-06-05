/** Strip leading `www.` for dedupe/comparison only; preserve original host elsewhere. */
export function canonicalDomainFromHost(host: string): string {
  const h = host.trim().toLowerCase();
  if (!h) return "";
  return h.replace(/^www\./, "");
}
