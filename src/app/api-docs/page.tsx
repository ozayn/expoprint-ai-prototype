import type { Metadata } from "next";
import Link from "next/link";
import { ApiDocsCommandBuilder } from "@/components/ApiDocsCommandBuilder";

export const metadata: Metadata = {
  title: "Design-intake API — local docs",
  description:
    "Phase 1 POST /api/design-intake/extract — usage and local test commands.",
};

const linkClass =
  "inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400";

export default function ApiDocsPage() {
  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Local prototype
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
              Design-intake extraction API
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              Phase 1 integration endpoint for ExpoPrint&apos;s downstream system.
              First stable contract — not production-final; human review still required.
            </p>
          </div>
          <nav className="flex shrink-0 flex-wrap gap-2">
            <Link href="/" className={linkClass}>
              Back to editor
            </Link>
            <Link href="/demo" className={linkClass}>
              Guided demo
            </Link>
            <Link href="/api-test" className={linkClass}>
              API test
            </Link>
            <Link href="/progress" className={linkClass}>
              Progress
            </Link>
          </nav>
        </header>

        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">Endpoint</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">
                POST /api/design-intake/extract
              </code>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              Send a public website URL plus optional intake hints. The server runs a
              bounded multi-page scrape, logo candidate ranking, typography signals, and
              optional Claude structured extraction. Responses are normalized JSON for
              ExpoPrint — no raw HTML or full scraped text.
            </p>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">Request body</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 marker:text-zinc-400">
              <li>
                <strong className="font-medium text-zinc-800">websiteUrl</strong>{" "}
                (required) — public HTTPS URL to inspect
              </li>
              <li>
                <strong className="font-medium text-zinc-800">productCategory</strong>{" "}
                (optional) — e.g. Outdoor tent
              </li>
              <li>
                <strong className="font-medium text-zinc-800">components</strong>{" "}
                (optional) — string array, e.g. [&quot;Canopy tent&quot;]
              </li>
              <li>
                <strong className="font-medium text-zinc-800">stylePreference</strong>{" "}
                (optional) — e.g. Modern, Conservative
              </li>
              <li>
                <strong className="font-medium text-zinc-800">
                  customerInstructions
                </strong>{" "}
                (optional) — extra factual hints for Claude
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">Response sections</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700 marker:text-zinc-400">
              <li>
                <strong className="font-medium text-zinc-800">business</strong> — name,
                website, domain, canonical URL
              </li>
              <li>
                <strong className="font-medium text-zinc-800">brand</strong> — colors,
                typography signals, ranked logo candidates
              </li>
              <li>
                <strong className="font-medium text-zinc-800">content</strong> — services,
                products, contact (phone, email, address, social)
              </li>
              <li>
                <strong className="font-medium text-zinc-800">designIntake</strong> —
                recommended headline/supporting copy, missing assets, confidence notes,{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
                  needsHumanReview: true
                </code>
              </li>
              <li>
                <strong className="font-medium text-zinc-800">metadata</strong> — source,
                pages inspected,{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
                  websiteFetch
                </code>
                , Claude status, warnings
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">
              Visual test harnesses
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              The home editor (
              <Link
                href="/"
                className="font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500"
              >
                /
              </Link>
              ) and{" "}
              <Link
                href="/demo"
                className="font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500"
              >
                guided demo
              </Link>{" "}
              use{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
                POST /api/analyze-website
              </code>{" "}
              to fill intake and drive Fabric previews. They share the same scrape + Claude
              pipeline but return UI-oriented payloads. This page documents the
              integration-facing extract contract.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              Full schema and limitations:{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
                docs/design-intake-api.md
              </code>{" "}
              in the repository.
            </p>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">
              Test sites for extraction QA
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              Curated URLs and a review checklist for logo ranking, typography, services/products
              cleanup, contact/social fields, and canvas quality. Use with{" "}
              <Link
                href="/api-test"
                className="font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500"
              >
                API test
              </Link>{" "}
              or the editor after changing the request URL.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              Reference:{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
                docs/test-sites.md
              </code>{" "}
              in the repository (includes expoprint.io, stripe.com, google.com, and retail
              stress cases).
            </p>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-900">
              Automated extraction evaluation
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              Ground-truth fixtures in{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
                data/extraction-eval-fixtures.json
              </code>{" "}
              compare extract responses to expected paths (logo source, typography, services,
              pages inspected, etc.). Requires a running local server and preferably{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
                ANTHROPIC_API_KEY
              </code>
              .
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
                npm run api:evaluate
              </code>{" "}
              — see{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
                docs/extraction-evaluation.md
              </code>
              .
            </p>
          </section>

          <ApiDocsCommandBuilder />
        </div>
      </main>
    </div>
  );
}
