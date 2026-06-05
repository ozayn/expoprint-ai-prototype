"use client";

import { useState } from "react";
import Link from "next/link";

export function InternalEvalLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/internal/eval/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setError("Incorrect password.");
        return;
      }

      window.location.reload();
    } catch {
      setError("Could not sign in. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-full bg-white text-zinc-900">
      <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
        <p className="text-sm text-zinc-500">
          <Link href="/" className="hover:text-zinc-800">
            ← Back to editor
          </Link>
        </p>

        <h1 className="mt-8 text-xl font-semibold tracking-tight">
          Historical evaluation
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Password required. Sample data only — no partner exports on this route.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="internal-eval-password"
              className="block text-xs font-medium text-zinc-600"
            >
              Password
            </label>
            <input
              id="internal-eval-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300"
              required
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {pending ? "Signing in…" : "View sample eval"}
          </button>
        </form>
      </div>
    </div>
  );
}
