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
    title: "Design intake state / debugging milestone",
    status: "Complete",
    summary:
      "Prototype intake panel is wired end-to-end to shared state, mock extraction, a generated brief, and intake-driven canvas output. No real website scraping or AI yet.",
    accomplishments: [
      "Controlled form fields for URL, business name, category, style preference, and instructions.",
      "Product component and extracted-content checkboxes and style dropdown update nested intake state as expected.",
      "“Generate Design Brief” fills the brief from the current selection (components, checked extracted rows, and edited field values).",
      "“Generate Sample Concept” can render from intake-derived DesignSpec after mock extraction is in play; supporting copy and colors respect selected extracted rows where implemented.",
      "Style choice applies simple layout differences on the canvas (accent treatment and text alignment), for visible A/B between presets.",
      "Live “Selected for design” summary under the panel to confirm state without generating the canvas.",
    ],
  },
  {
    id: 6,
    title: "Intake-driven canvas and design surfaces",
    status: "Complete",
    summary:
      "The Fabric preview can follow the same intake object as the form: copy, palette, contact strip, and per-component surface metadata. Still mock extraction and hand-authored mapping — real website scraping and AI generation remain planned.",
    accomplishments: [
      "Connected design intake state to canvas generation through `createDesignSpecFromIntake` and the existing DesignSpec → Fabric renderer.",
      "Generated concepts can show business name, website/domain, supporting line from selected services, products, or checked components, and brand colors parsed from selected extracted swatches where present.",
      "Optional compact contact/footer text on the canvas when phone, email, social, or (for trade show booth only) address rows are selected, with length kept short so the layout stays readable.",
      "“Design surfaces” tab-style controls list checked product components (e.g. canopy tent, back wall, side wall, flag, or booth equivalents); one Fabric canvas stays active, and the chosen surface updates `productType` / `templateId` on the next generate.",
      "Editable Fabric layers and JSON, PNG, and SVG exports preserved at the 1000×600 artboard size.",
    ],
  },
  {
    id: 7,
    title: "Demo layout and mobile clarity pass",
    status: "Complete",
    summary:
      "Reorganized the home page for a clearer demo path and lighter default chrome: intake → extracted → brief on the left, concept preview on the right, exports tucked away. Layout and copy only — no change to Fabric export dimensions or generation rules.",
    accomplishments: [
      "Labeled sections for design intake, extracted review, and design brief so the mock workflow reads top-to-bottom.",
      "Placed “Generate Sample Concept” and design-surface pickers next to the canvas preview; shortened helper text.",
      "Grouped export/import actions and raw canvas JSON under collapsed details/summary blocks so casual demos see less developer UI by default.",
      "Adjusted mobile spacing, touch targets, and preview scaling behavior already in place; horizontal scrolling for the artboard preview is still avoided via scaled CSS dimensions.",
      "Fabric editability, JSON/PNG/SVG export, Load JSON, and 1000×600 export geometry unchanged.",
    ],
  },
  {
    id: 8,
    title: "AI-assisted design intake workflow",
    status: "Planned",
    summary:
      "Extend the prototype intake with real AI assistance, validation, and workflow features beyond mock extraction.",
    accomplishments: [
      "Client-side intake and canvas wiring exist through Stage 7; LLM or agent-driven intake not implemented.",
    ],
  },
  {
    id: 9,
    title: "Website/content extraction",
    status: "Planned",
    summary:
      "Extract logo, colors, contact info, services, products, social links, and useful marketing copy from the customer website.",
    accomplishments: ["Not started yet."],
  },
  {
    id: 10,
    title: "Design brief generation",
    status: "Planned",
    summary:
      "Generate a structured design brief for the internal ExpoPrint design team based on selected extracted content.",
    accomplishments: ["Not started yet."],
  },
  {
    id: 11,
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
