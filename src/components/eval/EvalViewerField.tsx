/** Shared detail field for eval gallery/table expanded rows. */
export function EvalDetailField({
  label,
  value,
  mono = false,
  omitted = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  omitted?: boolean;
}) {
  if (omitted) {
    return (
      <div>
        <dt className="text-[11px] text-zinc-400">{label}</dt>
        <dd className="mt-0.5 text-sm italic text-zinc-400">Not published</dd>
      </div>
    );
  }

  const v = value.trim();
  if (!v) return null;
  return (
    <div>
      <dt className="text-[11px] text-zinc-400">{label}</dt>
      <dd className={`mt-0.5 break-all ${mono ? "font-mono text-xs" : ""}`}>{v}</dd>
    </div>
  );
}
