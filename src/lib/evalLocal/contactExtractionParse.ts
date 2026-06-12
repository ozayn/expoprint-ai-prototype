import { safeHttpHref } from "./evalRowUrl";
import type { ReviewQueueRow } from "./reviewQueueTypes";

export type ParsedSocialLink = {
  label: string;
  url: string;
};

export type ParsedContactLink = {
  label?: string;
  url: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const PHONE_RE = /^[\d\s().+\-xext]+$/i;

export function parseJsonStringList(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  } catch {
    return trimmed
      .split(/[;,|·]+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
}

export function parseSocialLinksJson(raw: string): ParsedSocialLink[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: ParsedSocialLink[] = [];
    for (const item of parsed) {
      if (typeof item === "string") {
        const url = safeHttpHref(item);
        if (url) out.push({ label: socialLabelFromUrl(url), url });
        continue;
      }
      if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        const urlRaw = String(rec.url ?? rec.href ?? "").trim();
        const url = safeHttpHref(urlRaw);
        if (!url) continue;
        const label =
          typeof rec.label === "string" && rec.label.trim()
            ? rec.label.trim()
            : typeof rec.platform === "string" && rec.platform.trim()
              ? rec.platform.trim()
              : socialLabelFromUrl(url);
        out.push({ label, url });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function parseContactLinksJson(raw: string): ParsedContactLink[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: ParsedContactLink[] = [];
    for (const item of parsed) {
      if (typeof item === "string") {
        const url = safeHttpHref(item);
        if (url) out.push({ url });
        continue;
      }
      if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        const urlRaw = String(rec.url ?? rec.href ?? "").trim();
        const url = safeHttpHref(urlRaw);
        if (!url) continue;
        const label =
          typeof rec.label === "string" && rec.label.trim()
            ? rec.label.trim()
            : undefined;
        out.push({ label, url });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function normalizeEmail(value: string): string | null {
  const t = value.trim().toLowerCase();
  if (!t || !EMAIL_RE.test(t)) return null;
  return t;
}

export function normalizePhone(value: string): string | null {
  const t = value.trim();
  if (!t || !PHONE_RE.test(t)) return null;
  const digits = t.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return t;
}

export function safeTelHref(phone: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const digits = normalized.replace(/[^\d+]/g, "");
  if (digits.length < 7) return null;
  return `tel:${digits}`;
}

export function socialLabelFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("instagram")) return "Instagram";
  if (lower.includes("facebook") || lower.includes("fb.com")) return "Facebook";
  if (lower.includes("linkedin")) return "LinkedIn";
  if (lower.includes("twitter") || lower.includes("x.com")) return "X";
  if (lower.includes("youtube") || lower.includes("youtu.be")) return "YouTube";
  if (lower.includes("tiktok")) return "TikTok";
  return "Other";
}

function isSocialUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("instagram") ||
    lower.includes("facebook") ||
    lower.includes("fb.com") ||
    lower.includes("linkedin") ||
    lower.includes("twitter") ||
    lower.includes("x.com") ||
    lower.includes("youtube") ||
    lower.includes("youtu.be") ||
    lower.includes("tiktok")
  );
}

function pushUniqueString(list: string[], seen: Set<string>, value: unknown): void {
  if (typeof value !== "string") return;
  const t = value.replace(/\s+/g, " ").trim();
  if (!t) return;
  const key = t.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  list.push(t);
}

function pushEmail(list: string[], seen: Set<string>, value: unknown): void {
  if (typeof value !== "string") return;
  const email = normalizeEmail(value);
  if (!email || seen.has(email)) return;
  seen.add(email);
  list.push(email);
}

function pushPhone(list: string[], seen: Set<string>, value: unknown): void {
  if (typeof value !== "string") return;
  const phone = normalizePhone(value);
  if (!phone) return;
  const key = phone.replace(/\D/g, "");
  if (seen.has(key)) return;
  seen.add(key);
  list.push(phone);
}

function pushSocial(
  list: ParsedSocialLink[],
  seen: Set<string>,
  value: unknown,
  labelHint?: string,
): void {
  if (typeof value === "string") {
    const url = safeHttpHref(value);
    if (!url || seen.has(url)) return;
    seen.add(url);
    list.push({
      label: labelHint?.trim() || socialLabelFromUrl(url),
      url,
    });
    return;
  }
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const urlRaw = String(rec.url ?? rec.href ?? "").trim();
    const url = safeHttpHref(urlRaw);
    if (!url || seen.has(url)) return;
    seen.add(url);
    const label =
      typeof rec.label === "string" && rec.label.trim()
        ? rec.label.trim()
        : typeof rec.platform === "string" && rec.platform.trim()
          ? rec.platform.trim()
          : labelHint?.trim() || socialLabelFromUrl(url);
    list.push({ label, url });
  }
}

function pushContactLink(
  list: ParsedContactLink[],
  seen: Set<string>,
  value: unknown,
  labelHint?: string,
): void {
  if (typeof value === "string") {
    const url = safeHttpHref(value);
    if (!url || seen.has(url)) return;
    seen.add(url);
    list.push({ label: labelHint?.trim() || undefined, url });
    return;
  }
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const urlRaw = String(rec.url ?? rec.href ?? "").trim();
    const url = safeHttpHref(urlRaw);
    if (!url || seen.has(url)) return;
    seen.add(url);
    list.push({
      label:
        typeof rec.label === "string" && rec.label.trim()
          ? rec.label.trim()
          : labelHint?.trim() || undefined,
      url,
    });
  }
}

function walkContactValue(
  emails: string[],
  emailSeen: Set<string>,
  phones: string[],
  phoneSeen: Set<string>,
  social: ParsedSocialLink[],
  socialSeen: Set<string>,
  addresses: string[],
  addressSeen: Set<string>,
  links: ParsedContactLink[],
  linkSeen: Set<string>,
  value: unknown,
  keyHint?: string,
): void {
  if (value == null) return;

  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return;
    if (normalizeEmail(t)) {
      pushEmail(emails, emailSeen, t);
      return;
    }
    if (normalizePhone(t)) {
      pushPhone(phones, phoneSeen, t);
      return;
    }
    const url = safeHttpHref(t);
    if (url) {
      if (isSocialUrl(url)) pushSocial(social, socialSeen, url);
      else pushContactLink(links, linkSeen, url, keyHint);
    } else if (t.length > 8) {
      pushUniqueString(addresses, addressSeen, t);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) walkContactValue(
      emails,
      emailSeen,
      phones,
      phoneSeen,
      social,
      socialSeen,
      addresses,
      addressSeen,
      links,
      linkSeen,
      item,
      keyHint,
    );
    return;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const keyLower = key.toLowerCase();
      if (keyLower.includes("email")) {
        walkContactValue(
          emails,
          emailSeen,
          phones,
          phoneSeen,
          social,
          socialSeen,
          addresses,
          addressSeen,
          links,
          linkSeen,
          child,
          key,
        );
        continue;
      }
      if (keyLower.includes("phone") || keyLower === "tel") {
        walkContactValue(
          emails,
          emailSeen,
          phones,
          phoneSeen,
          social,
          socialSeen,
          addresses,
          addressSeen,
          links,
          linkSeen,
          child,
          key,
        );
        continue;
      }
      if (
        keyLower.includes("social") ||
        keyLower.includes("instagram") ||
        keyLower.includes("facebook") ||
        keyLower.includes("linkedin")
      ) {
        walkContactValue(
          emails,
          emailSeen,
          phones,
          phoneSeen,
          social,
          socialSeen,
          addresses,
          addressSeen,
          links,
          linkSeen,
          child,
          key,
        );
        continue;
      }
      if (
        keyLower.includes("address") ||
        keyLower.includes("location") ||
        keyLower === "city" ||
        keyLower === "region"
      ) {
        walkContactValue(
          emails,
          emailSeen,
          phones,
          phoneSeen,
          social,
          socialSeen,
          addresses,
          addressSeen,
          links,
          linkSeen,
          child,
          key,
        );
        continue;
      }
      walkContactValue(
        emails,
        emailSeen,
        phones,
        phoneSeen,
        social,
        socialSeen,
        addresses,
        addressSeen,
        links,
        linkSeen,
        child,
        key,
      );
    }
  }
}

/** Collect contact tokens from expo_output across known API shapes. */
export function collectContactFromExpo(expo: unknown): {
  emails: string[];
  phones: string[];
  social: ParsedSocialLink[];
  addresses: string[];
  contactLinks: ParsedContactLink[];
} {
  const emails: string[] = [];
  const emailSeen = new Set<string>();
  const phones: string[] = [];
  const phoneSeen = new Set<string>();
  const social: ParsedSocialLink[] = [];
  const socialSeen = new Set<string>();
  const addresses: string[] = [];
  const addressSeen = new Set<string>();
  const contactLinks: ParsedContactLink[] = [];
  const linkSeen = new Set<string>();

  if (!expo || typeof expo !== "object") {
    return { emails, phones, social, addresses, contactLinks };
  }

  const root = expo as Record<string, unknown>;
  const content = root.content as Record<string, unknown> | undefined;
  const business = root.business as Record<string, unknown> | undefined;

  if (content?.contact) {
    walkContactValue(
      emails,
      emailSeen,
      phones,
      phoneSeen,
      social,
      socialSeen,
      addresses,
      addressSeen,
      contactLinks,
      linkSeen,
      content.contact,
    );
  }

  walkContactValue(
    emails,
    emailSeen,
    phones,
    phoneSeen,
    social,
    socialSeen,
    addresses,
    addressSeen,
    contactLinks,
    linkSeen,
    root.contact,
  );
  walkContactValue(
    emails,
    emailSeen,
    phones,
    phoneSeen,
    social,
    socialSeen,
    addresses,
    addressSeen,
    contactLinks,
    linkSeen,
    root.emails,
  );
  walkContactValue(
    emails,
    emailSeen,
    phones,
    phoneSeen,
    social,
    socialSeen,
    addresses,
    addressSeen,
    contactLinks,
    linkSeen,
    root.phoneNumbers,
  );
  walkContactValue(
    emails,
    emailSeen,
    phones,
    phoneSeen,
    social,
    socialSeen,
    addresses,
    addressSeen,
    contactLinks,
    linkSeen,
    root.socialLinks,
  );
  walkContactValue(
    emails,
    emailSeen,
    phones,
    phoneSeen,
    social,
    socialSeen,
    addresses,
    addressSeen,
    contactLinks,
    linkSeen,
    root.socials,
  );
  walkContactValue(
    emails,
    emailSeen,
    phones,
    phoneSeen,
    social,
    socialSeen,
    addresses,
    addressSeen,
    contactLinks,
    linkSeen,
    root.addresses,
  );
  walkContactValue(
    emails,
    emailSeen,
    phones,
    phoneSeen,
    social,
    socialSeen,
    addresses,
    addressSeen,
    contactLinks,
    linkSeen,
    root.locations,
  );
  walkContactValue(
    emails,
    emailSeen,
    phones,
    phoneSeen,
    social,
    socialSeen,
    addresses,
    addressSeen,
    contactLinks,
    linkSeen,
    root.contactLinks,
  );
  walkContactValue(
    emails,
    emailSeen,
    phones,
    phoneSeen,
    social,
    socialSeen,
    addresses,
    addressSeen,
    contactLinks,
    linkSeen,
    root.links,
  );

  if (business) {
    pushContactLink(contactLinks, linkSeen, business.website, "Website");
    pushContactLink(contactLinks, linkSeen, business.canonicalUrl, "Website");
  }

  return {
    emails: emails.slice(0, 8),
    phones: phones.slice(0, 8),
    social: social.slice(0, 12),
    addresses: addresses.slice(0, 4),
    contactLinks: contactLinks.slice(0, 8),
  };
}

export function contactFieldsFromCollected(
  collected: ReturnType<typeof collectContactFromExpo>,
): Pick<
  ReviewQueueRow,
  | "extracted_emails"
  | "extracted_phone_numbers"
  | "extracted_social_links"
  | "extracted_addresses"
  | "extracted_contact_links"
> {
  return {
    extracted_emails:
      collected.emails.length > 0 ? JSON.stringify(collected.emails) : "",
    extracted_phone_numbers:
      collected.phones.length > 0 ? JSON.stringify(collected.phones) : "",
    extracted_social_links:
      collected.social.length > 0 ? JSON.stringify(collected.social) : "",
    extracted_addresses:
      collected.addresses.length > 0 ? JSON.stringify(collected.addresses) : "",
    extracted_contact_links:
      collected.contactLinks.length > 0
        ? JSON.stringify(collected.contactLinks)
        : "",
  };
}

export function emailsForRow(row: ReviewQueueRow): string[] {
  return parseJsonStringList(row.extracted_emails ?? "")
    .map((e) => normalizeEmail(e))
    .filter((e): e is string => Boolean(e));
}

export function phonesForRow(row: ReviewQueueRow): string[] {
  return parseJsonStringList(row.extracted_phone_numbers ?? "")
    .map((p) => normalizePhone(p))
    .filter((p): p is string => Boolean(p));
}

export function socialLinksForRow(row: ReviewQueueRow): ParsedSocialLink[] {
  return parseSocialLinksJson(row.extracted_social_links ?? "");
}

export function addressesForRow(row: ReviewQueueRow): string[] {
  return parseJsonStringList(row.extracted_addresses ?? "");
}

export function contactLinksForRow(row: ReviewQueueRow): ParsedContactLink[] {
  return parseContactLinksJson(row.extracted_contact_links ?? "");
}

export function primaryAddressForRow(row: ReviewQueueRow): string {
  return addressesForRow(row)[0] ?? "";
}
