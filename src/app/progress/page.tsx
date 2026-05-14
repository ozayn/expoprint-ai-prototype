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
    title: "Optional Claude-backed Analyze Website",
    status: "Complete",
    summary:
      "Added a narrow, optional server path so Analyze Website can ask Claude for structured extracted rows from the current intake fields only. The Anthropic API key stays in environment variables; there is still no end-to-end AI design generation — mock extraction remains the safe default when the key is absent or the model output cannot be used. A later slice (Stage 10) adds homepage-only HTML fetch to enrich Claude context; full-site crawling is still out of scope.",
    accomplishments: [
      "Added a server-side Next.js API route (`POST /api/analyze-website`) for Analyze Website using the official Anthropic SDK.",
      "Claude API key is read only from server environment variables and is never sent to the browser.",
      "When the route succeeds with validated output, Analyze Website can populate the extracted-content panel from Claude-generated structured fields (still inferred from intake hints, not from scraped pages).",
      "The intake UI reports whether Claude extraction was applied or a mocked fallback was used after each analyze run.",
      "API responses include cautious debug metadata (`source`, `claudeAttempted`, `model`, `durationMs`, `reason` on failures) without exposing secrets or raw customer payloads in logs.",
      "Mock extraction is preserved when the API key is missing, the Anthropic call fails, or the model response is not valid usable JSON for the app.",
      "Locally verified in development: responses can return ok: true with source claude when configured; failures still fall back to mock.",
      "Stage 10 adds a single-homepage fetch (title/meta/OG/links/text) to improve Claude context when the URL loads; no crawler or browser automation — not production-grade extraction.",
    ],
  },
  {
    id: 9,
    title: "AI-assisted design intake workflow",
    status: "Planned",
    summary:
      "Extend the prototype intake with real AI assistance, validation, and workflow features beyond mock extraction.",
    accomplishments: [
      "Client-side intake and canvas wiring exist through Stage 10; optional Claude analyze plus a cautious homepage-only fetch (no crawler) exist, but broader LLM/agent intake is not implemented.",
    ],
  },
  {
    id: 10,
    title: "Website/content extraction",
    status: "Complete",
    summary:
      "First homepage-only fetch for Analyze Website: the server retrieves the entered public URL once (no crawling, no browser automation), parses HTML for lightweight signals, and passes a bounded text summary to Claude. Failures fall back to the prior intake-only context. This is prototype-grade, not audited for every site or anti-bot edge case.",
    accomplishments: [
      "Homepage GET with timeout and response size cap; http/https URLs only after normalization.",
      "Parsed title, meta description, og:title / og:description, favicon / apple-touch / og:image and simple “logo” img heuristics as URL candidates (not verified assets).",
      "Collected mailto:, tel:, and a small set of major social host links from anchor hrefs.",
      "Produced a capped visible-text excerpt for Claude (not echoed back in the public API JSON).",
      "API exposes `websiteFetch` metadata (`status`, optional `reason`, counts, `finalUrl`) so demos can see fetch vs skip vs failure without shipping raw HTML.",
      "No full-site crawl, no sitemap follow, no headless browser — production-hardened scraping and validation remain future work.",
    ],
  },
  {
    id: 11,
    title: "Production-ready design brief generation",
    status: "Planned",
    summary:
      "The prototype already generates a basic live design brief from selected intake and extracted rows. Planned work is to make this more structured, validated, and designer-ready for internal ExpoPrint workflows.",
    accomplishments: [
      "Basic prototype brief exists from selected intake and extracted content.",
      "Planned: add stronger section structure, validation, prioritization, and designer handoff formatting.",
      "Planned: optionally use AI to highlight important customer instructions and recommend which content should appear on each selected design surface.",
    ],
  },
  {
    id: 12,
    title: "AI-generated editable DesignSpec",
    status: "Planned",
    summary:
      "Use AI to generate editable DesignSpec JSON that can populate Fabric.js templates.",
    accomplishments: ["Not started yet."],
  },
  {
    id: 13,
    title: "Guided customer-style demo view",
    status: "Complete",
    summary:
      "Added a separate `/demo` route with a step-by-step guided intake for a cleaner customer-style presentation. The home `/` editor workspace is unchanged and remains where JSON/PNG/SVG export and developer-oriented tools live.",
    accomplishments: [
      "New client flow (`GuidedIntakeDemo`) uses seven steps: website, category, components, style, special instructions plus Analyze Website, then a review step with editable business name (after analysis) and extracted rows, then the Fabric concept preview. Back/Continue and a simple step counter; `/` editor unchanged.",
      "Reuses the same pipeline as the editor: `DesignIntakeState`, `POST /api/analyze-website` (Claude when available, mock fallback with a clear status line), `computeDesignBriefText`, `createDesignSpecFromIntake`, and `renderDesignSpecToFabric` on a 1000×600 Fabric canvas with design-surface tabs when multiple components are selected.",
      "Mobile-friendly single column, large tap targets, and width-scaled canvas preview (`cssOnly` scaling); no export drawer or dev tools on `/demo` — users follow “Open editor view” for exports.",
    ],
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
