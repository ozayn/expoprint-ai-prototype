import Link from "next/link";
import { FabricDesignEditor } from "@/components/FabricDesignEditor";

export default function Home() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-5 overflow-x-clip px-3 py-6 sm:gap-6 sm:px-6 sm:py-8 lg:px-8">
        <p className="flex min-h-10 items-center justify-end text-right text-sm">
          <Link
            href="/progress"
            className="font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline"
          >
            View project progress
          </Link>
        </p>
        <FabricDesignEditor />
      </main>
    </div>
  );
}
