import { FabricDesignEditor } from "@/components/FabricDesignEditor";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-zinc-50 text-zinc-900">
      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <FabricDesignEditor />
      </main>
    </div>
  );
}
