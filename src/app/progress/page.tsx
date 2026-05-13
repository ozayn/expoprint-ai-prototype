import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Project progress — ExpoPrint AI prototype",
  description: "Stages and roadmap for the ExpoPrint Fabric.js prototype.",
};

type StageStatus = "Complete" | "Planned";

type Stage = {
  id: number;
  title: string;
  status: StageStatus;
  summary: string;
  accomplishments: string[];
};

const stages: Stage[] = [
  {
    id: 1,
    title: "Standalone Fabric.js editor",
    status: "Complete",
    summary:
      "Created a standalone Next.js prototype with an editable Fabric.js canvas.",
    accomplishments: [
      "Added client-only Fabric.js canvas.",
      "Added sample concept generation.",
      "Added editable background, shape, logo placeholder, and text layers.",
      "Added export to JSON, PNG, and SVG.",
    ],
  },
  {
    id: 2,
    title: "DesignSpec architecture",
    status: "Complete",
    summary:
      "Separated design generation from Fabric rendering using an app-level DesignSpec format.",
    accomplishments: [
      "Added DesignSpec TypeScript types.",
      "Added sampleDesignSpec.",
      "Added renderDesignSpecToFabric.",
      "Made the design output AI-friendly because future AI can generate DesignSpec JSON instead of raw Fabric code.",
    ],
  },
  {
    id: 3,
    title: "Local workflow and deployment",
    status: "Complete",
    summary: "Made the prototype easy to run locally and share online.",
    accomplishments: [
      "Added scripts/dev.sh.",
      "Added npm run dev:local.",
      "Pushed the repo to GitHub.",
      "Deployed the working prototype on Railway.",
    ],
  },
  {
    id: 4,
    title: "Demo polish and reliability fixes",
    status: "Complete",
    summary: "Improved the demo experience and fixed Fabric rendering issues.",
    accomplishments: [
      "Added canvas status messaging.",
      "Fixed disabled/invisible button styling.",
      "Added “What this proves” sidebar panel.",
      "Fixed Fabric origin behavior so generated objects use top-left coordinates.",
      "Added preview scaling while keeping export dimensions unchanged.",
    ],
  },
  {
    id: 5,
    title: "AI-assisted design intake workflow",
    status: "Planned",
    summary:
      "Add a form that collects product category, website, business name, style, components, and customer instructions.",
    accomplishments: ["Not started yet."],
  },
  {
    id: 6,
    title: "Website/content extraction",
    status: "Planned",
    summary:
      "Extract logo, colors, contact info, services, products, social links, and useful marketing copy from the customer website.",
    accomplishments: ["Not started yet."],
  },
  {
    id: 7,
    title: "Design brief generation",
    status: "Planned",
    summary:
      "Generate a structured design brief for the internal ExpoPrint design team based on selected extracted content.",
    accomplishments: ["Not started yet."],
  },
  {
    id: 8,
    title: "AI-generated editable DesignSpec",
    status: "Planned",
    summary:
      "Use AI to generate editable DesignSpec JSON that can populate Fabric.js templates.",
    accomplishments: ["Not started yet."],
  },
];

function StatusBadge({ status }: { status: StageStatus }) {
  const isComplete = status === "Complete";
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isComplete
          ? "bg-emerald-100 text-emerald-800"
          : "bg-zinc-200 text-zinc-700"
      }`}
    >
      {status}
    </span>
  );
}

export default function ProgressPage() {
  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-10">
          <p className="text-sm text-zinc-500">
            <Link href="/" className="font-medium text-zinc-700 underline-offset-4 hover:underline">
              ← Back to editor
            </Link>
          </p>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-900">
            ExpoPrint AI prototype — progress
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
            Stages completed so far and planned next steps. A written work log lives in{" "}
            <code className="rounded bg-zinc-200/80 px-1 py-0.5 font-mono text-xs">
              docs/work-log.md
            </code>{" "}
            for Clockify-style time entry notes.
          </p>
        </header>

        <ol className="flex flex-col gap-5">
          {stages.map((stage) => (
            <li key={stage.id}>
              <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-base font-semibold text-zinc-900">
                    Stage {stage.id} — {stage.title}
                  </h2>
                  <StatusBadge status={stage.status} />
                </div>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Status
                </p>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600">{stage.summary}</p>
                <div className="mt-4 border-t border-zinc-100 pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                    Accomplishments
                  </p>
                  <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-zinc-700 marker:text-zinc-400">
                    {stage.accomplishments.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
