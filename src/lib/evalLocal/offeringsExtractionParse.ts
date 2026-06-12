import { parseJsonStringList } from "./contactExtractionParse";
import type { ReviewQueueRow } from "./reviewQueueTypes";

const OFFERING_KEY =
  /^(products?|services?|offerings?|productservices|productsandservices)$/i;

function normalizeOfferingText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 160);
}

function pushOffering(
  list: string[],
  seen: Set<string>,
  value: unknown,
): void {
  if (typeof value === "string") {
    const t = normalizeOfferingText(value);
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    list.push(t);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) pushOffering(list, seen, item);
    return;
  }

  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const name =
      typeof rec.name === "string"
        ? rec.name
        : typeof rec.title === "string"
          ? rec.title
          : typeof rec.label === "string"
            ? rec.label
            : "";
    if (name.trim()) {
      pushOffering(list, seen, name);
      return;
    }
    for (const child of Object.values(rec)) {
      pushOffering(list, seen, child);
    }
  }
}

function pushOfferingsFromObject(
  products: string[],
  productSeen: Set<string>,
  services: string[],
  serviceSeen: Set<string>,
  combined: string[],
  combinedSeen: Set<string>,
  value: unknown,
  kind: "products" | "services" | "combined",
): void {
  if (kind === "products") {
    pushOffering(products, productSeen, value);
    return;
  }
  if (kind === "services") {
    pushOffering(services, serviceSeen, value);
    return;
  }
  pushOffering(combined, combinedSeen, value);
}

function walkOfferingsNode(
  products: string[],
  productSeen: Set<string>,
  services: string[],
  serviceSeen: Set<string>,
  combined: string[],
  combinedSeen: Set<string>,
  value: unknown,
  keyHint?: string,
): void {
  if (value == null) return;

  const keyLower = keyHint?.toLowerCase() ?? "";

  if (keyLower.includes("product") && !keyLower.includes("service")) {
    pushOfferingsFromObject(
      products,
      productSeen,
      services,
      serviceSeen,
      combined,
      combinedSeen,
      value,
      "products",
    );
    return;
  }
  if (keyLower.includes("service")) {
    pushOfferingsFromObject(
      products,
      productSeen,
      services,
      serviceSeen,
      combined,
      combinedSeen,
      value,
      "services",
    );
    return;
  }
  if (
    keyLower.includes("offering") ||
    keyLower.includes("productservice") ||
    keyLower === "productsandservices"
  ) {
    pushOfferingsFromObject(
      products,
      productSeen,
      services,
      serviceSeen,
      combined,
      combinedSeen,
      value,
      "combined",
    );
    return;
  }

  if (typeof value === "string" || Array.isArray(value)) {
    pushOffering(combined, combinedSeen, value);
    return;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      walkOfferingsNode(
        products,
        productSeen,
        services,
        serviceSeen,
        combined,
        combinedSeen,
        child,
        key,
      );
    }
  }
}

/** Collect products/services from expo_output across known API shapes. */
export function collectOfferingsFromExpo(expo: unknown): {
  products: string[];
  services: string[];
  combined: string[];
} {
  const products: string[] = [];
  const productSeen = new Set<string>();
  const services: string[] = [];
  const serviceSeen = new Set<string>();
  const combined: string[] = [];
  const combinedSeen = new Set<string>();

  if (!expo || typeof expo !== "object") {
    return { products, services, combined };
  }

  const root = expo as Record<string, unknown>;
  const content = root.content as Record<string, unknown> | undefined;
  const business = root.business as Record<string, unknown> | undefined;
  const brand = root.brand as Record<string, unknown> | undefined;
  const designSpec = root.designSpec as Record<string, unknown> | undefined;
  const extracted = root.extracted as Record<string, unknown> | undefined;

  if (content) {
    walkOfferingsNode(
      products,
      productSeen,
      services,
      serviceSeen,
      combined,
      combinedSeen,
      content.products,
      "products",
    );
    walkOfferingsNode(
      products,
      productSeen,
      services,
      serviceSeen,
      combined,
      combinedSeen,
      content.services,
      "services",
    );
  }

  for (const [key, value] of Object.entries(root)) {
    if (OFFERING_KEY.test(key)) {
      walkOfferingsNode(
        products,
        productSeen,
        services,
        serviceSeen,
        combined,
        combinedSeen,
        value,
        key,
      );
    }
  }

  if (business) {
    walkOfferingsNode(
      products,
      productSeen,
      services,
      serviceSeen,
      combined,
      combinedSeen,
      business.products,
      "products",
    );
    walkOfferingsNode(
      products,
      productSeen,
      services,
      serviceSeen,
      combined,
      combinedSeen,
      business.services,
      "services",
    );
    walkOfferingsNode(
      products,
      productSeen,
      services,
      serviceSeen,
      combined,
      combinedSeen,
      business.offerings,
      "offerings",
    );
  }

  if (brand) {
    walkOfferingsNode(
      products,
      productSeen,
      services,
      serviceSeen,
      combined,
      combinedSeen,
      brand.products,
      "products",
    );
    walkOfferingsNode(
      products,
      productSeen,
      services,
      serviceSeen,
      combined,
      combinedSeen,
      brand.services,
      "services",
    );
  }

  if (extracted) {
    walkOfferingsNode(
      products,
      productSeen,
      services,
      serviceSeen,
      combined,
      combinedSeen,
      extracted.products,
      "products",
    );
    walkOfferingsNode(
      products,
      productSeen,
      services,
      serviceSeen,
      combined,
      combinedSeen,
      extracted.services,
      "services",
    );
  }

  if (designSpec) {
    walkOfferingsNode(
      products,
      productSeen,
      services,
      serviceSeen,
      combined,
      combinedSeen,
      designSpec.products,
      "products",
    );
    walkOfferingsNode(
      products,
      productSeen,
      services,
      serviceSeen,
      combined,
      combinedSeen,
      designSpec.services,
      "services",
    );
  }

  const mergedCombined: string[] = [];
  const mergedSeen = new Set<string>();
  for (const item of combined) {
    const key = item.toLowerCase();
    if (mergedSeen.has(key)) continue;
    mergedSeen.add(key);
    mergedCombined.push(item);
  }
  for (const item of [...products, ...services]) {
    const key = item.toLowerCase();
    if (mergedSeen.has(key)) continue;
    mergedSeen.add(key);
    mergedCombined.push(item);
  }

  return {
    products: products.slice(0, 24),
    services: services.slice(0, 24),
    combined: mergedCombined.slice(0, 32),
  };
}

export function offeringsFieldsFromCollected(
  collected: ReturnType<typeof collectOfferingsFromExpo>,
): Pick<
  ReviewQueueRow,
  | "extracted_products"
  | "extracted_services"
  | "extracted_products_services"
> {
  return {
    extracted_products:
      collected.products.length > 0 ? JSON.stringify(collected.products) : "",
    extracted_services:
      collected.services.length > 0 ? JSON.stringify(collected.services) : "",
    extracted_products_services:
      collected.combined.length > 0 ? JSON.stringify(collected.combined) : "",
  };
}

export function productsForRow(row: ReviewQueueRow): string[] {
  return parseJsonStringList(row.extracted_products ?? "");
}

export function servicesForRow(row: ReviewQueueRow): string[] {
  return parseJsonStringList(row.extracted_services ?? "");
}

export function offeringsForRow(row: ReviewQueueRow): string[] {
  const combined = parseJsonStringList(row.extracted_products_services ?? "");
  if (combined.length > 0) return combined;

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...productsForRow(row), ...servicesForRow(row)]) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function hasOfferingsForRow(row: ReviewQueueRow): boolean {
  return offeringsForRow(row).length > 0;
}
