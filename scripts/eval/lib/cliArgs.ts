/** Flags that consume the next argv token as their value. */
export const CLI_FLAGS_WITH_VALUE = [
  "--limit",
  "--offset",
  "--delay-ms",
  "--api-url",
] as const;

export function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

export function getArgNumber(flag: string, defaultValue: number): number {
  const raw = getArg(flag);
  if (raw === undefined) return defaultValue;
  const n = Number(raw);
  return Number.isFinite(n) ? n : defaultValue;
}

export function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

/** First argv token that is not a flag or a flag value (npm passes args after `--`). */
export function firstPositionalArg(argv: string[] = process.argv): string | undefined {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (token.startsWith("--")) {
      if (
        (CLI_FLAGS_WITH_VALUE as readonly string[]).includes(token) &&
        i + 1 < args.length
      ) {
        i += 1;
      }
      continue;
    }
    return token;
  }
  return undefined;
}

export function printHelp(usage: string, lines: string[]): void {
  console.log(usage);
  for (const line of lines) {
    console.log(`  ${line}`);
  }
}
