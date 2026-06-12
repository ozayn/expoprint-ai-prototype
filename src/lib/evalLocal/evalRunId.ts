/** UTC run id: YYYYMMDDHHmmss or YYYYMMDDHHmmssSSS (milliseconds). */
export const EVAL_RUN_ID_PATTERN = "20\\d{12}(?:\\d{3})?";

export function runTimestampIdUtc(): string {
  const d = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return [
    d.getUTCFullYear(),
    pad(d.getUTCMonth() + 1),
    pad(d.getUTCDate()),
    pad(d.getUTCHours()),
    pad(d.getUTCMinutes()),
    pad(d.getUTCSeconds()),
    pad(d.getUTCMilliseconds(), 3),
  ].join("");
}

export function timestampFromEvalArtifactName(name: string): string | null {
  const m = name.match(new RegExp(`_(${EVAL_RUN_ID_PATTERN})\\.(csv|jsonl)$`));
  return m?.[1] ?? null;
}
