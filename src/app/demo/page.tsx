import type { Metadata } from "next";
import { GuidedIntakeDemo } from "@/components/GuidedIntakeDemo";

export const metadata: Metadata = {
  title: "Guided demo — ExpoPrint AI prototype",
  description:
    "Step-by-step design intake demo using the same Claude, brief, and Fabric pipeline as the editor.",
};

export default function DemoPage() {
  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900">
      <GuidedIntakeDemo />
    </div>
  );
}
