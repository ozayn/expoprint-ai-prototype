import type { Metadata } from "next";
import Link from "next/link";
import { DesignIntakeApiTester } from "@/components/DesignIntakeApiTester";
import { DevEvalNavLink } from "@/components/DevEvalNavLink";

export const metadata: Metadata = {
  title: "Design-intake API test",
  description: "Browser UI to call POST /api/design-intake/extract and inspect JSON.",
};

const linkClass =
  "inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400";

export default function ApiTestPage() {
  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Local prototype
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              Design-intake API test
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Run{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
                POST /api/design-intake/extract
              </code>{" "}
              from the browser, inspect the JSON response, and preview the generated
              canvas concept.
            </p>
          </div>
          <nav className="flex shrink-0 flex-wrap gap-2">
            <Link href="/" className={linkClass}>
              Back to editor
            </Link>
            <Link href="/demo" className={linkClass}>
              Guided demo
            </Link>
            <Link href="/api-docs" className={linkClass}>
              API docs
            </Link>
            <Link href="/progress" className={linkClass}>
              Progress
            </Link>
            <DevEvalNavLink className={linkClass} />
          </nav>
        </header>

        <DesignIntakeApiTester />
      </main>
    </div>
  );
}
