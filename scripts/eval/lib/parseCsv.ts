/**
 * Minimal RFC 4180-style CSV parser for local Metabase exports (no extra deps).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }

    if (ch === "\r") {
      i += 1;
      if (text[i] === "\n") i += 1;
      pushField();
      pushRow();
      continue;
    }

    if (ch === "\n") {
      pushField();
      pushRow();
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  if (field.length > 0 || row.length > 0) {
    pushField();
    pushRow();
  }

  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

export function csvRowsToObjects(
  rows: string[][],
): { headers: string[]; records: Record<string, string>[] } {
  if (rows.length === 0) {
    return { headers: [], records: [] };
  }
  const headers = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      obj[header] = (cells[idx] ?? "").trim();
    });
    return obj;
  });
  return { headers, records };
}
