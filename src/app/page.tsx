import Link from "next/link";
import { DeployPlatformBadge } from "@/components/DeployPlatformBadge";
import { DevEvalNavLink, InternalEvalNavLink } from "@/components/DevEvalNavLink";
import { FabricDesignEditor } from "@/components/FabricDesignEditor";

export default function Home() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-5 overflow-x-clip px-3 py-6 sm:gap-6 sm:px-6 sm:py-8 lg:px-8">
        <DeployPlatformBadge />
        <header className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Link
            href="/api-docs"
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
          >
            API docs
          </Link>
          <Link
            href="/api-test"
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
          >
            API test
          </Link>
          <Link
            href="/demo"
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
          >
            Open guided demo
          </Link>
          <Link
            href="/progress"
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
          >
            View progress
          </Link>
          <InternalEvalNavLink />
          <DevEvalNavLink />
        </header>
        <FabricDesignEditor />
      </main>
    </div>
  );
}
