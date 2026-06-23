/** Normalize and dedupe contact fields for API responses. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  if (s.toLowerCase().startsWith("mailto:")) {
    s = s.slice(7).split("?")[0]?.trim() ?? "";
  }
  s = s.toLowerCase().trim();
  if (!EMAIL_RE.test(s)) return "";
  return s;
}

export function phoneDigitsKey(raw: string): string {
  const stripped = raw.replace(/^tel:/i, "").trim();
  return stripped.replace(/\D/g, "");
}

export function normalizePhoneDisplay(raw: string): string {
  const stripped = raw.replace(/^tel:/i, "").trim();
  if (!stripped) return "";
  const digits = phoneDigitsKey(stripped);
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return stripped.replace(/\s+/g, " ").trim();
}

export function dedupeEmails(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const n = normalizeEmail(v);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function dedupePhones(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const display = normalizePhoneDisplay(v);
    const key = phoneDigitsKey(display);
    if (!key || key.length < 7 || seen.has(key)) continue;
    seen.add(key);
    out.push(display);
  }
  return out;
}

export function dedupeAddresses(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = v.replace(/\s+/g, " ").trim();
    if (t.length < 12) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function normalizeContactPhoneField(raw: string): string {
  const parts = raw
    .split(/[,;|]/)
    .map((p) => normalizePhoneDisplay(p))
    .filter(Boolean);
  return dedupePhones(parts).join(", ");
}

export function normalizeContactEmailField(raw: string): string {
  const parts = raw
    .split(/[,;|]/)
    .map((p) => normalizeEmail(p))
    .filter(Boolean);
  return dedupeEmails(parts).join(", ");
}
