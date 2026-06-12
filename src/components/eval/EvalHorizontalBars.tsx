type BarItem = {
  key: string;
  label: string;
  count: number;
  /** Bar width as percent of max count in the set (0–100). */
  barPercent: number;
  detail?: string;
};

type Props = {
  items: BarItem[];
  emptyMessage?: string;
};

export function EvalHorizontalBars({ items, emptyMessage }: Props) {
  if (items.length === 0) {
    return emptyMessage ? (
      <p className="text-sm text-zinc-500">{emptyMessage}</p>
    ) : null;
  }

  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-zinc-600">
              {item.label}
              {item.detail ? (
                <span className="text-zinc-400"> {item.detail}</span>
              ) : null}
            </span>
            <span className="shrink-0 tabular-nums text-zinc-400">{item.count}</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-zinc-400/70 transition-[width]"
              style={{ width: `${item.barPercent}%` }}
              role="presentation"
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function barWidthsFromCounts(
  counts: number[],
): number[] {
  const max = Math.max(...counts, 1);
  return counts.map((count) =>
    count === 0 ? 0 : Math.round((count / max) * 100),
  );
}
