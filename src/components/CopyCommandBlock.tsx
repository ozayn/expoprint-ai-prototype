"use client";

import { useCallback, useState } from "react";

type CopyCommandBlockProps = {
  label: string;
  command: string;
};

export function CopyCommandBlock({ label, command }: CopyCommandBlockProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [command]);

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-950 text-zinc-100">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
        <span className="text-xs font-medium text-zinc-400">{label}</span>
        <button
          type="button"
          onClick={onCopy}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-zinc-100">
        <code>{command}</code>
      </pre>
    </div>
  );
}
