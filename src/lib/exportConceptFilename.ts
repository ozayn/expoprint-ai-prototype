/** Lowercase slug safe for download filenames (no extension). */
export function slugifyFilenamePart(value: string, maxLen = 48): string {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return "";
  return slug.length > maxLen ? slug.slice(0, maxLen).replace(/-+$/g, "") : slug;
}

export type ConceptExportExtension = "png" | "svg" | "json";

export type ConceptExportFilenameInput = {
  businessName?: string;
  surfaceLabel?: string | null;
  productCategory?: string;
  extension: ConceptExportExtension;
};

/**
 * Build a descriptive concept export filename, e.g. `google-backdrop-concept.png`.
 * Falls back to `expoprint-concept.png` when no business name is available.
 */
export function buildConceptExportFilename(
  input: ConceptExportFilenameInput,
): string {
  const parts: string[] = [];

  const business = slugifyFilenamePart(input.businessName ?? "");
  if (business) {
    parts.push(business);
  } else {
    parts.push("expoprint");
  }

  const surface = input.surfaceLabel
    ? slugifyFilenamePart(input.surfaceLabel)
    : "";
  if (surface) parts.push(surface);

  if (parts.length === 1 && parts[0] === "expoprint") {
    const category = input.productCategory
      ? slugifyFilenamePart(input.productCategory)
      : "";
    if (category) parts.push(category);
  }

  parts.push("concept");

  return `${parts.join("-")}.${input.extension}`;
}
