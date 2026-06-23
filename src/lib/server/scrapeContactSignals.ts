import { load, type CheerioAPI } from "cheerio";
import {
  dedupeAddresses,
  dedupeEmails,
  dedupePhones,
  normalizeEmail,
  normalizePhoneDisplay,
} from "@/lib/contactFieldNormalize";

export type ScrapedStructuredContact = {
  emails: string[];
  phones: string[];
  addresses: string[];
  footerTextSample: string;
};

const JSON_LD_BUSINESS_TYPE_RE =
  /Organization|LocalBusiness|Store|Corporation|ProfessionalService|MedicalBusiness|FinancialService|EducationalOrganization|SportsOrganization|GovernmentOrganization/i;

const FOOTER_TEXT_CAP = 2_000;

function pushEmail(collector: string[], raw: unknown): void {
  if (typeof raw !== "string") return;
  const n = normalizeEmail(raw);
  if (n) collector.push(n);
}

function pushPhone(collector: string[], raw: unknown): void {
  if (typeof raw !== "string") return;
  const n = normalizePhoneDisplay(raw);
  if (n && phoneDigitsOk(n)) collector.push(n);
}

function phoneDigitsOk(display: string): boolean {
  const digits = display.replace(/\D/g, "");
  return digits.length >= 7;
}

function formatPostalAddress(addr: Record<string, unknown>): string | null {
  const parts = [
    addr.streetAddress,
    addr.addressLocality,
    addr.addressRegion,
    addr.postalCode,
    addr.addressCountry,
  ]
    .filter((v) => typeof v === "string" && v.trim())
    .map((v) => (v as string).trim());
  if (parts.length < 2) return null;
  const joined = parts.join(", ");
  if (joined.length < 12 || joined.length > 240) return null;
  return joined;
}

function visitJsonLdContact(node: unknown, collector: ScrapedStructuredContact): void {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const item of node) visitJsonLdContact(item, collector);
    return;
  }
  if (typeof node !== "object") return;

  const o = node as Record<string, unknown>;
  const typeRaw = o["@type"];
  const types: string[] = [];
  if (typeof typeRaw === "string") types.push(typeRaw);
  if (Array.isArray(typeRaw)) {
    for (const t of typeRaw) {
      if (typeof t === "string") types.push(t);
    }
  }
  const isBusiness =
    types.some((t) => JSON_LD_BUSINESS_TYPE_RE.test(t)) ||
    "email" in o ||
    "telephone" in o ||
    "address" in o ||
    "contactPoint" in o;

  if (isBusiness) {
    pushEmail(collector.emails, o.email);
    pushPhone(collector.phones, o.telephone);
    if (typeof o.address === "string") {
      const t = o.address.trim();
      if (t.length >= 12 && t.length <= 240) collector.addresses.push(t);
    } else if (o.address && typeof o.address === "object" && !Array.isArray(o.address)) {
      const formatted = formatPostalAddress(o.address as Record<string, unknown>);
      if (formatted) collector.addresses.push(formatted);
    }
    const contactPoint = o.contactPoint;
    if (contactPoint) {
      const points = Array.isArray(contactPoint) ? contactPoint : [contactPoint];
      for (const cp of points) {
        if (!cp || typeof cp !== "object") continue;
        const c = cp as Record<string, unknown>;
        pushEmail(collector.emails, c.email);
        pushPhone(collector.phones, c.telephone);
      }
    }
  }

  for (const v of Object.values(o)) {
    visitJsonLdContact(v, collector);
  }
}

export function extractFooterTextSample($: CheerioAPI): string {
  const parts: string[] = [];
  $("footer, [role='contentinfo'], [role=\"contentinfo\"], #footer, .site-footer, .footer, .page-footer")
    .each((_, el) => {
      const t = $(el).text().replace(/\s+/g, " ").trim();
      if (t.length >= 20) parts.push(t);
    });
  const merged = parts.join(" · ").trim();
  return merged.slice(0, FOOTER_TEXT_CAP);
}

export function extractStructuredContactFromHtml(html: string): ScrapedStructuredContact {
  const $ = load(html);
  const collector: ScrapedStructuredContact = {
    emails: [],
    phones: [],
    addresses: [],
    footerTextSample: extractFooterTextSample($),
  };

  $("script[type='application/ld+json'], script[type=\"application/ld+json\"]").each(
    (_, el) => {
      const raw = $(el).html()?.trim();
      if (!raw) return;
      try {
        visitJsonLdContact(JSON.parse(raw), collector);
      } catch {
        /* ignore invalid JSON-LD */
      }
    },
  );

  collector.emails = dedupeEmails(collector.emails).slice(0, 16);
  collector.phones = dedupePhones(collector.phones).slice(0, 16);
  collector.addresses = dedupeAddresses(collector.addresses).slice(0, 8);

  return collector;
}

export function mergeStructuredContacts(
  pages: ScrapedStructuredContact[],
): ScrapedStructuredContact {
  const emails: string[] = [];
  const phones: string[] = [];
  const addresses: string[] = [];
  const footerParts: string[] = [];

  for (const p of pages) {
    emails.push(...p.emails);
    phones.push(...p.phones);
    addresses.push(...p.addresses);
    if (p.footerTextSample.trim()) footerParts.push(p.footerTextSample.trim());
  }

  return {
    emails: dedupeEmails(emails).slice(0, 16),
    phones: dedupePhones(phones).slice(0, 16),
    addresses: dedupeAddresses(addresses).slice(0, 8),
    footerTextSample: footerParts.join(" · ").slice(0, FOOTER_TEXT_CAP),
  };
}
