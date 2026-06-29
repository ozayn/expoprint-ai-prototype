/** Column ids shared between review queue table and URL inventory table. */
export const EVAL_TABLE_COLUMN_IDS = [
  "status",
  "logos",
  "colors",
  "domain",
  "extracted_business_name",
  "emails",
  "phones",
  "social",
  "offerings",
  "normalized_url",
  "ds_number",
  "project_title",
  "project_type",
  "shop_code",
  "source_column",
  "address",
  "contact_links",
  "extracted_summary",
  "palette_source",
  "palette_confidence",
  "pages_inspected",
  "elapsed_ms",
  "provider_model",
  "error_message",
] as const;

export type EvalTableColumnId = (typeof EVAL_TABLE_COLUMN_IDS)[number];

export const EVAL_TABLE_COLUMN_STORAGE_KEY = "expoprint.eval.visibleColumns";

/** Canonical column order for table headers and cells. */
export const EVAL_TABLE_COLUMN_ORDER: EvalTableColumnId[] = [...EVAL_TABLE_COLUMN_IDS];

export const EVAL_TABLE_DEFAULT_VISIBLE: EvalTableColumnId[] = [
  "status",
  "logos",
  "colors",
  "domain",
  "extracted_business_name",
  "emails",
  "phones",
  "social",
  "offerings",
];

export const EVAL_TABLE_MINIMAL_VISIBLE: EvalTableColumnId[] = [
  "status",
  "logos",
  "colors",
  "domain",
  "extracted_business_name",
];

export const EVAL_TABLE_INVENTORY_ONLY_COLUMNS: EvalTableColumnId[] = [
  "source_column",
];

export const EVAL_TABLE_PARTNER_ONLY_COLUMNS: EvalTableColumnId[] = [
  "project_title",
  "project_type",
  "shop_code",
  "source_column",
];

export const EVAL_TABLE_COLUMN_LABELS: Record<EvalTableColumnId, string> = {
  domain: "Source / domain",
  normalized_url: "Normalized URL",
  ds_number: "DS number",
  project_title: "Project title",
  project_type: "Project type",
  shop_code: "Shop code",
  source_column: "Source column",
  extracted_business_name: "Business name",
  logos: "Logos",
  colors: "Colors",
  emails: "Emails",
  phones: "Phones",
  social: "Social links",
  address: "Address / location",
  contact_links: "Contact links",
  offerings: "Products / services",
  extracted_summary: "Summary",
  palette_source: "Palette source",
  palette_confidence: "Palette confidence",
  status: "Status",
  pages_inspected: "Pages inspected",
  elapsed_ms: "Elapsed ms",
  provider_model: "Provider / model",
  error_message: "Error message",
};

/** Short labels for compact table headers. */
export const EVAL_TABLE_COLUMN_HEADER_LABELS: Partial<
  Record<EvalTableColumnId, string>
> = {
  domain: "source",
  normalized_url: "url",
  project_type: "type",
  extracted_business_name: "business name",
  offerings: "products / services",
  extracted_summary: "summary",
  contact_links: "contact links",
  pages_inspected: "pages",
  provider_model: "provider",
  error_message: "error",
};

export function evalTableColumnHeaderLabel(id: EvalTableColumnId): string {
  return EVAL_TABLE_COLUMN_HEADER_LABELS[id] ?? EVAL_TABLE_COLUMN_LABELS[id];
}

export function isEvalTableColumnId(value: string): value is EvalTableColumnId {
  return (EVAL_TABLE_COLUMN_IDS as readonly string[]).includes(value);
}

export function parseStoredVisibleColumns(raw: string | null): EvalTableColumnId[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const ids = parsed.filter(
      (item): item is EvalTableColumnId =>
        typeof item === "string" && isEvalTableColumnId(item),
    );
    return ids.length > 0 ? ids : null;
  } catch {
    return null;
  }
}

export type EvalTableColumnContext = {
  inventoryMode?: boolean;
  omitPartnerFields?: boolean;
};

export function pickableEvalTableColumns(
  context: EvalTableColumnContext = {},
): EvalTableColumnId[] {
  const { inventoryMode = false, omitPartnerFields = false } = context;
  return EVAL_TABLE_COLUMN_ORDER.filter((id) => {
    if (EVAL_TABLE_INVENTORY_ONLY_COLUMNS.includes(id) && !inventoryMode) {
      return false;
    }
    if (EVAL_TABLE_PARTNER_ONLY_COLUMNS.includes(id) && omitPartnerFields) {
      return false;
    }
    return true;
  });
}

export function allEvalTableColumnsForContext(
  context: EvalTableColumnContext = {},
): EvalTableColumnId[] {
  return pickableEvalTableColumns(context);
}

export function orderedVisibleEvalColumns(
  visibleIds: EvalTableColumnId[],
  context: EvalTableColumnContext = {},
): EvalTableColumnId[] {
  const visibleSet = new Set(visibleIds);
  return pickableEvalTableColumns(context).filter((id) => visibleSet.has(id));
}

export function normalizeVisibleColumnSelection(
  ids: EvalTableColumnId[],
  context: EvalTableColumnContext = {},
): EvalTableColumnId[] {
  const pickable = new Set(pickableEvalTableColumns(context));
  const seen = new Set<EvalTableColumnId>();
  const normalized: EvalTableColumnId[] = [];

  for (const id of EVAL_TABLE_COLUMN_ORDER) {
    if (!pickable.has(id) || !ids.includes(id) || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }

  if (normalized.length > 0) return normalized;
  return orderedVisibleEvalColumns(EVAL_TABLE_DEFAULT_VISIBLE, context);
}
