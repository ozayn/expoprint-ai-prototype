import type { Metadata } from "next";
import Link from "next/link";
import { loadCoverageBenchmarkSummary } from "@/lib/evalLocal/loadCoverageBenchmarks";
import { COVERAGE_SNAPSHOT_FIELD_LABELS } from "@/lib/evalLocal/coverageSnapshot";

export const metadata: Metadata = {
  title: "Project progress — ExpoPrint AI prototype",
  description: "Stages and roadmap for the ExpoPrint Fabric.js prototype.",
};

type StageStatus = "Complete" | "Planned" | "In progress";

type Stage = {
  id: number;
  title: string;
  status: StageStatus;
  /** First date the stage was functionally complete (YYYY-MM-DD). */
  completed?: string;
  /** Later refinement date when work continued after completion (YYYY-MM-DD). */
  lastUpdated?: string;
  summary: string;
  accomplishments: string[];
};

function StageDates({
  status,
  completed,
  lastUpdated,
}: {
  status: StageStatus;
  completed?: string;
  lastUpdated?: string;
}) {
  if (status === "Planned") {
    return <p className="mt-2 text-xs text-zinc-500">Planned</p>;
  }
  const showUpdated =
    lastUpdated !== undefined && lastUpdated !== "" && lastUpdated !== completed;
  if (!completed && !showUpdated) {
    return <p className="mt-2 text-xs text-zinc-500">Date: Not recorded yet</p>;
  }
  return (
    <div className="mt-2 space-y-0.5 text-xs text-zinc-500">
      {completed ? <p>Completed: {completed}</p> : null}
      {showUpdated ? <p>Last updated: {lastUpdated}</p> : null}
    </div>
  );
}

const stages: Stage[] = [
  {
    id: 1,
    title: "Standalone Fabric.js editor",
    status: "Complete",
    completed: "2026-05-12",
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
    completed: "2026-05-12",
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
    completed: "2026-05-12",
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
    completed: "2026-05-12",
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
    completed: "2026-05-13",
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
    completed: "2026-05-13",
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
    completed: "2026-05-14",
    lastUpdated: "2026-05-21",
    summary:
      "Reorganized the home page for a clearer demo path and lighter default chrome: intake → extracted → brief on the left, concept preview on the right, exports tucked away. Layout and copy only — no change to Fabric export dimensions or generation rules.",
    accomplishments: [
      "Labeled sections for design intake, extracted review, and design brief so the mock workflow reads top-to-bottom.",
      "Placed “Generate Sample Concept” and design-surface pickers next to the canvas preview; shortened helper text.",
      "Grouped export/import actions and raw canvas JSON under collapsed details/summary blocks so casual demos see less developer UI by default.",
      "Adjusted mobile spacing, touch targets, and preview scaling behavior already in place; horizontal scrolling for the artboard preview is still avoided via scaled CSS dimensions.",
      "Fabric editability, JSON/PNG/SVG export, Load JSON, and 1000×600 export geometry unchanged.",
      "2026-05-21: `/` editor helper copy moved into accessible info tooltips; `/demo` guided explanations unchanged.",
    ],
  },
  {
    id: 8,
    title: "Optional Claude-backed Analyze Website",
    status: "Complete",
    completed: "2026-05-14",
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
    completed: "2026-05-14",
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
    completed: "2026-05-14",
    summary:
      "Added a separate `/demo` route with a step-by-step guided intake for a cleaner customer-style presentation. The home `/` editor workspace is unchanged and remains where JSON/PNG/SVG export and developer-oriented tools live.",
    accomplishments: [
      "New client flow (`GuidedIntakeDemo`) uses seven steps: website, category, components, style, special instructions plus Analyze Website, then a review step with editable business name (after analysis) and extracted rows, then the Fabric concept preview. Back/Continue and a simple step counter; `/` editor unchanged.",
      "Reuses the same pipeline as the editor: `DesignIntakeState`, `POST /api/analyze-website` (Claude when available, mock fallback with a clear status line), `computeDesignBriefText`, `createDesignSpecFromIntake`, and `renderDesignSpecToFabric` on a 1000×600 Fabric canvas with design-surface tabs when multiple components are selected.",
      "Mobile-friendly single column, large tap targets, and width-scaled canvas preview (`cssOnly` scaling); no export drawer or dev tools on `/demo` — users follow “Open editor view” for exports.",
    ],
  },
  {
    id: 14,
    title: "Style guide layer for cleaner generated concepts",
    status: "Complete",
    completed: "2026-05-14",
    summary:
      "Added a prototype design-style layer so extracted brand colors are normalized before being used on the editable Fabric canvas. Bright palettes are treated as accents, and generated concepts prioritize contrast, readability, and cleaner large-format-print composition.",
    accomplishments: [
      "`normalizeBrandPalette` maps extracted hexes to semantic roles (`backgroundColor`, `textColor`, `accentColor`, `secondaryAccentColor`, `mutedTextColor`); `buildConceptColorPlan` adds muted accent polygon fill, style-scaled opacity, and a smaller accent polygon when many saturated primaries are detected.",
      "`contrastRatio`, `ensureReadableText`, and `avoidProblematicPairings` reduce red/blue, yellow-on-white, and teal-on-blue style failures; bright palettes stay on neutral fields with small accents — not production color management.",
      "`createDesignSpecFromIntake` scales polygon points by `accentPolygonScale`, bumps headline/supporting/website/contact font sizes slightly, and applies the plan for both `/` and `/demo` with no API or new AI calls.",
    ],
  },
  {
    id: 15,
    title: "Small multi-page website extraction",
    status: "Complete",
    completed: "2026-05-19",
    summary:
      "Analyze Website now enriches Claude with a bounded slice of the site beyond the homepage only: the server loads the homepage, discovers same-domain links, ranks about/services/contact-style paths, and fetches at most three extra HTML pages (no recursion, no browser automation, no full crawl). Raw page text is never returned to the client; API responses add safe `websiteFetch` counters and page-type hints only.",
    accomplishments: [
      "Homepage plus up to three same-domain candidate pages (keyword-ranked anchors from the homepage HTML only).",
      "Heuristic buckets for discovery: about, services/products/solutions-style, contact/locations, portfolio/work, plus high-priority tokens (about, services, products, solutions, contact, work, portfolio, menu, locations).",
      "Per-page GET with timeout and HTML byte cap; extras that fail or are near-duplicate of already-kept text are skipped without breaking the overall analyze flow.",
      "Claude context: homepage block plus additional page sections, then deduped mailto/tel/social and logo candidates across inspected pages; visible excerpts capped (~8k homepage, ~4k per extra, ~18k total visible budget).",
      "`websiteFetch` metadata includes `pagesAttempted`, `pagesFetched`, `pagesFailed`, optional `pageTypesFound`, and approximate `textChars` sent to the model — still no raw HTML in JSON.",
      "UI status line can show “N pages inspected” when multiple pages were successfully fetched; `/` and `/demo` behavior otherwise unchanged.",
    ],
  },
  {
    id: 16,
    title: "Logo candidate extraction, ranking, and review",
    status: "Complete",
    completed: "2026-05-19",
    lastUpdated: "2026-05-21",
    summary:
      "Analyze Website collects logo candidates from icons, apple-touch-icons, og:image, header/nav imagery, and logo-like `<img>` tags. Candidates are scored and sorted for design usefulness — full header wordmarks and logo-tagged brand images should rank above small transparent favicons. Review grid on `/` and `/demo`; designers pick one manually. Selected logos can render via the safe proxy when load succeeds; placeholder fallback and production upload guidance remain.",
    accomplishments: [
      "Server-side parsing extends to header/nav `<img>` tags, splits favicon vs. apple-touch-icon, and records `alt`, `width`, `height` when available — still same-origin and no full-site crawl.",
      "Logo candidate ranking for design usefulness: header/nav and logo-tagged images with brand/wordmark evidence rank first; SVG wordmarks and wider header logos beat small square favicons even when favicons are transparent.",
      "Transparency is a small bonus only — it must not outweigh header placement, wordmark proportions, brand name in alt/URL, or larger usable dimensions; favicon/icon sources get explicit fallback and small-icon penalties.",
      "API `websiteFetch.logoCandidatesList` returns up to ~6 candidates sorted by `score` descending with optional `transparency` and `reason` — not production asset validation.",
      "Client intake state carries `logoCandidates` + `selectedLogoCandidateUrl`; merge logic clears stale selections when a fresh analyze returns a different list and resets cleanly on mock fallback.",
      "`LogoCandidatesReview`: ranked list with “Best match” on the first row and “Transparent likely” when detected; failed thumbnails fall back to `N/A`. No auto-select — first row is simply the top-ranked candidate.",
      "2026-05-21: wordmark-first ranking polish; review UI filters weak favicon/product icons when a strong header logo loads; shorter production-logo reminders on `/`.",
      "Canvas behavior is conservative on purpose: when a candidate is selected the existing dashed logo placeholder switches to a solid stroke and bumps label opacity (no remote image embedded — avoids tainted-canvas / CORS issues with PNG/SVG export).",
      "Design brief lists the selected candidate URL with a reminder that a production-quality logo upload is still recommended before print.",
      "CSP `img-src` allows `https:` so external favicons / og:images render in previews; `http:` remains blocked.",
    ],
  },
  {
    id: 17,
    title: "Selected logo rendering via safe proxy",
    status: "Complete",
    completed: "2026-05-19",
    summary:
      "Prototype milestone: when a designer selects a logo candidate from website extraction, the editable Fabric preview can show that image inside the logo area — but only when the same-origin `/api/proxy-image` route successfully fetches an allowed image type. Remote URLs are not loaded directly into Fabric (avoids tainted canvas / CORS issues). Not all third-party logos will always load; this is not print-ready logo handling or production-grade asset validation. Production-quality logo upload and review are still expected later.",
    accomplishments: [
      "Added a server-side image proxy route (`GET /api/proxy-image?url=...`) for selected logo candidates, with http/https-only URLs, public-IP DNS checks, timeout, response size cap, and a small image MIME whitelist.",
      "Selected logo candidates can render inside the Fabric canvas when they load safely through the proxy (not guaranteed for every remote URL).",
      "Remote logos are loaded through the app proxy instead of directly from third-party domains; Fabric uses `crossOrigin: 'anonymous'` on the same-origin proxied URL.",
      "Fabric places the logo inside the existing logo placeholder area while preserving aspect ratio; the image layer stays selectable/editable on the canvas.",
      "If the proxy or image load fails, the canvas keeps the safe logo placeholder and “Logo selected / candidate recorded” labels — the flow does not error out.",
      "PNG export is intended to remain CORS-clean when the proxied image loads successfully; this is prototype behavior, not final print production proofing.",
      "SVG export may still reference the proxied image URL depending on Fabric’s `toSVG()` behavior (inline bytes when possible, otherwise an external `<image href>`) — not final production asset handling.",
      "Production-quality logo upload and validation are still needed later; UI copy in `LogoCandidatesReview` sets that expectation on `/` and `/demo`.",
    ],
  },
  {
    id: 18,
    title: "Prototype deployment — Vercel on main",
    status: "Complete",
    completed: "2026-05-20",
    summary:
      "Added Vercel deployment config on `main` (`vercel.json`, API `maxDuration`, CSP tweak when `VERCEL=1`, home-page deploy badge). The app was briefly split across Railway (`main`) and a `vercel-deploy` branch; Railway services and the extra branches are now removed, and Vercel on `main` is the current demo path.",
    accomplishments: [
      "`vercel.json` plus route `maxDuration` for `/api/analyze-website` (60s) and `/api/proxy-image` (15s); `docs/vercel-deploy.md` documents env vars (`ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL`).",
      "Home page shows a Vercel-only badge (`DeployPlatformBadge`) with git branch + short SHA when `VERCEL=1`.",
      "Verified on Vercel: multi-page extraction, Claude analyze, logo candidate review, proxied logo on canvas, `/` and `/demo` flows.",
      "Earlier: tested Railway on `main` and a separate `vercel-deploy` branch; later simplified to Vercel-only deploys from `main` after Railway build/platform issues.",
      "Deleted `staging` and `vercel-deploy` branches; Railway project/services removed — see Deployment status above for the current rule.",
    ],
  },
  {
    id: 19,
    title: "Typography/font signal extraction",
    status: "Complete",
    completed: "2026-05-20",
    lastUpdated: "2026-05-21",
    summary:
      "Analyze Website collects lightweight typography signals from inspected pages and maps them to safe browser/Fabric font stacks on generated concepts. Feeds the Phase 1 extraction API and the editor/demo pipeline — prototype tone matching only, not exact production font reproduction.",
    accomplishments: [
      "Server extraction parses font-family from inline styles, `<style>` blocks, `--font*` CSS variables, and `fonts.googleapis.com` link tags; optional same-origin stylesheet fetch (strict size/timeout caps, no recursive `@import`).",
      "Merged `typography` metadata on `websiteFetch` (font name lists + `styleGuess` — no raw CSS in API JSON).",
      "Claude prompt includes typography signals when present; instructs cautious tone inference only.",
      "`typographyMapping.ts` maps detected families (Inter, Roboto, Montserrat, Playfair, etc.) to safe system/geometric/serif stacks for Fabric text layers.",
      "`createDesignSpecFromIntake` applies mapped fonts to headline, supporting, website, and contact text; sizes unchanged for readability.",
      "Compact “Typography signals” row in Review identity on `/` and `/demo`, including empty and mock-fallback states.",
      "Font-family cleanup filters non-font CSS tokens (`normal`, numeric weights, `1.0`, `!important`, lengths); stack families like `system-ui` and `-apple-system` are kept.",
      "`websiteFetch.typography` counts (`fontFamilyCount`, `googleFontCount`) match the cleaned lists returned in API JSON — not raw pre-clean totals.",
      "Signals feed the extract API and canvas mapping via safe browser/Fabric stacks only — no webfont downloads.",
      "2026-05-21: `websiteFetch.typography` counts aligned with cleaned font lists after token filtering.",
    ],
  },
  {
    id: 20,
    title: "Design-intake extraction API contract",
    status: "Complete",
    completed: "2026-05-21",
    summary:
      "Phase 1 integration deliverable: `POST /api/design-intake/extract` accepts a public website URL plus optional product category, components, style preference, and customer instructions, then returns normalized JSON for ExpoPrint’s downstream system. Reuses the bounded scrape + Claude pipeline (logo candidates, typography, services/products, contact, design recommendations, metadata). No raw HTML or full scraped text in responses. `/` and `/demo` remain visual consumers and test harnesses via `POST /api/analyze-website`. First stable v1 contract — not production-final; `needsHumanReview` stays true.",
    accomplishments: [
      "Implemented `POST /api/design-intake/extract` — request: `websiteUrl` (required) plus optional `productCategory`, `components`, `stylePreference`, `customerInstructions`.",
      "Response sections: `business`, `brand` (colors, typography, ranked `logoCandidates`), `content` (services, products, contact), `designIntake` (recommendations, `missingAssets`, `confidenceNotes`, `needsHumanReview: true`), `metadata` (`source`, `pagesInspected`, `websiteFetch`, `claude`, `warnings`).",
      "Shared pipeline in `claudeWebsiteAnalyze.ts` + `buildDesignIntakeApiResponse.ts`; partial `ok: true` with `metadata.source: scraper_only` when Claude is unavailable but scrape data is useful.",
      "`POST /api/analyze-website` refactored to the same pipeline — editor and guided demo UI behavior unchanged.",
      "Contract documented in `docs/design-intake-api.md`; `vercel.json` allows 60s for the extract route on Vercel.",
      "Safe for integration: no API keys, secrets, raw HTML, or full-page text blobs in public JSON.",
      "Logo, typography, and Claude-inferred fields are signals only — human review and production assets still required before print.",
    ],
  },
  {
    id: 21,
    title: "API docs and browser tester",
    status: "Complete",
    completed: "2026-05-21",
    lastUpdated: "2026-05-21",
    summary:
      "Local tooling to exercise the Phase 1 extract API without hand-writing curl every time: `/api-docs` explains the contract with copyable commands, `/api-test` runs the API from the browser, and a shell/npm helper supports terminal smoke tests. Uses the current host origin so the same UI works locally and on Vercel. Prototype tooling only — not a public developer portal; human review still required on extraction output.",
    accomplishments: [
      "`/api-test` — browser UI to run `POST /api/design-intake/extract` against the current host (local or Vercel); summary panel (ok, business name, logos, services/products, Claude status, warnings) plus full copyable JSON with Copy/Clear.",
      "`/api-docs` — plain-language Phase 1 overview; form-driven command builder updates copyable `curl` from inputs (deployed curl uses the page origin, not hardcoded localhost).",
      "`npm run api:test` and `scripts/test-design-intake-api.sh` remain the local terminal helpers (`http://localhost:3000`).",
      "Website URL fields on `/api-test` and `/api-docs` accept bare domains (`cvs.com`, `google.com`); UI prepends `https://` on blur/submit before calling the API or generating curl/npm commands (backend validation unchanged).",
      "Helper copy under the URL field: domains default to https; empty submit shows an inline message.",
      "Editor header links to API docs and API test — no change to Fabric exports or scrape/Claude pipeline behavior.",
      "Smoke-tested on deployed Vercel (`main`): extract responses return expected normalized sections.",
    ],
  },
  {
    id: 22,
    title: "Bullet-list services/products on canvas",
    status: "Complete",
    completed: "2026-05-21",
    summary:
      "When selected services or products split into enough clean items, generated concepts can show readable bullet lines (•) in the supporting area instead of one long ` · ` line — especially on trade-show surfaces, back wall, and side wall. Canopy tent can still use the simpler one-line layout when appropriate. Prototype layout rules only — not a full template system.",
    accomplishments: [
      "`createDesignSpecFromIntake` chooses `bullet-list` vs `supporting-line` from item count, product category, and active design surface (trade show booth prefers bullets; back/side wall with 2+ items; 3+ items generally).",
      "Up to four bullets in a multiline Fabric `Textbox` with readable font size; `metadata.contentLayout` on DesignSpec records the choice for inspection.",
      "One-line supporting copy remains the fallback for canopy tent and tight vertical space; bullets are kept above the website/contact footer band.",
      "Applies to `/` and `/demo` through the shared DesignSpec → Fabric path; exports and editability unchanged.",
      "2026-05-21: display normalization for bullet phrases (sentence case, brands/acronyms/dimensions preserved, up to five bullets).",
    ],
  },
  {
    id: 23,
    title: "Extraction quality evaluation harness",
    status: "Complete",
    completed: "2026-05-21",
    summary:
      "Lightweight ground-truth checks for `POST /api/design-intake/extract`: JSON fixtures describe expected paths and values (business identity, logo candidates, typography, services/products, contact, metadata). `npm run api:evaluate` runs repeatable pass/fail checks against a local dev server. Required vs nice-to-have severities separate hard regressions from softer quality gaps. Prototype evaluation only — not a full production QA suite.",
    accomplishments: [
      "`data/extraction-eval-fixtures.json` — starter fixtures for expoprint.io, google.com, and stripe.com with optional intake hints.",
      "Check types: exact path match, path/array substring, exists, count ≥ N, logo candidate `source`, typography `styleGuess`.",
      "`scripts/evaluate-design-intake-api.mjs` + `npm run api:evaluate` — POST each fixture to `http://localhost:3000/api/design-intake/extract`, print per-check pass/fail with expected vs actual; `--verbose` for full JSON; nonzero exit on required failures.",
      "`docs/extraction-evaluation.md` — how to run; notes that the dev server and preferably `ANTHROPIC_API_KEY` should be configured for best results.",
      "Linked from `/api-docs`, `README`, and related docs (`test-sites.md` for manual QA URLs).",
      "Does not change scraping, Claude, Fabric, editor, demo, or export behavior — validation tooling only.",
    ],
  },
  {
    id: 24,
    title: "Extraction reliability and evaluation checks",
    status: "Complete",
    completed: "2026-05-21",
    lastUpdated: "2026-05-21",
    summary:
      "Improves extract API debuggability without changing the overall contract: deterministic business-name fallbacks (Claude → title/og:title → domain), structured `metadata.warnings` codes, `metadata.quality` summary, and multi-run fixture evaluation (`npm run api:evaluate -- --runs N`). Current fixtures pass all required checks locally — prototype reliability only, not a full production QA suite.",
    accomplishments: [
      "`resolveBusinessName` — prefers Claude `suggestedBusinessName`, then brand-like title/og:title, then cautious domain label (e.g. google.com → Google); adds `business_name_inferred_from_domain` when domain fallback is used.",
      "Reliability warning codes in `metadata.warnings`: `missing_business_name`, `missing_logo_candidates`, `missing_services_products`, `low_content_extracted`, `website_fetch_failed`, `site_blocked_static_fetch`, `claude_failed_or_skipped`, `large_site_partial_extraction`, `favicon_only_logo_candidate` (additive alongside human-readable lines).",
      "`metadata.quality` — `high` / `medium` / `low` for business name, logo, services/products, and overall (logo quality `low` when only favicon/icon candidates exist).",
      "`data/extraction-eval-fixtures.json` + `npm run api:evaluate` — required vs nice-to-have severities; required failures exit nonzero; current fixtures (expoprint.io, google.com, stripe.com) pass stable required checks.",
      "`evaluate-design-intake-api.mjs` supports `--runs N` with per-check pass rates and flaky detection.",
      "`npm run api:compare` — smoke-compare `POST /api/analyze-website` vs `POST /api/design-intake/extract` for the same URL.",
      "Documented in `docs/extraction-evaluation.md` and `docs/design-intake-api.md`. No Fabric/export behavior change.",
    ],
  },
  {
    id: 25,
    title: "Large-site partial extraction and editor/API alignment",
    status: "Complete",
    completed: "2026-05-21",
    summary:
      "Heavy homepages that exceed the HTML byte cap can still yield useful head metadata from a truncated prefix instead of failing completely. Editor `/` and guided `/demo` align with the integration extract API for business name, partial fetch status, and logo warnings — same shared scrape + Claude pipeline, not production-final extraction. No headless browser or full-site crawl.",
    accomplishments: [
      "Oversized homepage HTML (~800 KB cap): parse the first chunk when `Content-Length` or body size exceeds the cap; `websiteFetch.status: partial`, `reason: body_truncated`, warning `large_site_partial_extraction`.",
      "Example `cvs.com`: partial extraction still returns business name, typography, services/products, ranked logo candidates (e.g. `cvs-logo.svg` from JSON-LD/OG in the truncated head), and human-readable warnings — not a guarantee for every large site.",
      "Demo placeholder business name (`Example Brand Co.`) is treated as unset in Claude prompts so analyze-website and extract resolve the public name consistently (e.g. CVS Pharmacy); custom user-entered names are not overwritten.",
      "Partial `success` / `partial` fetch responses are valid Claude/scraper output in the editor and demo — status copy mentions large page partially inspected; not mock fallback.",
      "Favicon-only logo candidates: ranked as fallback, UI/API warn that production-quality logo upload is recommended; `missingAssets` and brief text reflect low logo quality — favicon is not presented as a strong production wordmark.",
      "Safer head-only logo discovery (JSON-LD logo/image, `og:logo`, header/nav images before generic `img-logo` scan) without increasing crawl scope or returning raw HTML.",
      "Shared pipeline documented: both `POST /api/analyze-website` and `POST /api/design-intake/extract` call `runClaudeWebsiteAnalyze` — prototype-grade; human review still required.",
    ],
  },
  {
    id: 26,
    title: "Browser-rendered extraction fallback",
    status: "Planned",
    summary:
      "Future stage: optional headless or browser-rendered fetch for sites that block static HTTP (403/WAF), without bypassing bot protection. Not started — static scrape + clear blocked-site warnings remain the v1 behavior.",
    accomplishments: [],
  },
  {
    id: 27,
    title: "Stale website intake reset",
    status: "Complete",
    completed: "2026-05-21",
    summary:
      "When the user changes the website URL to a different domain, website-specific analysis results clear immediately so prior business identity, logos, extracted rows, typography, and brief do not linger in the editor or guided demo. Product category, components, style, and special instructions are preserved. A new Analyze run still replaces identity/content for the new domain; partial extraction can update business name when the API returns it. Prototype UX only — not production-final intake validation.",
    accomplishments: [
      "`websiteIntakeReset.ts` + `analyzeWebsiteDomain.ts` — compare typed URL to `lastAnalyzedDomain` with normalized hosts (www, scheme, trailing slash ignored).",
      "Clears on domain change: business name (blank until Analyze or user entry), extracted rows, `showExtracted`, `extractionSource`, logo candidates, selected logo URL, typography signals, design brief; analyze status/notes reset.",
      "Preserves: product category, checked components, style preference, special instructions.",
      "Note when cleared: “Website changed — previous analysis cleared.” Editor regenerates canvas preview when applicable.",
      "Analyze merge (`analyzeWebsiteSuggestions.ts`) still replaces identity when the analyzed domain changes; same-domain re-analyze does not overwrite a custom edited business name.",
      "Works on `/` (`FabricDesignEditor`) and `/demo` (guided URL step and review).",
    ],
  },
  {
    id: 28,
    title: "Logo canvas fitting and candidate roles",
    status: "Complete",
    completed: "2026-05-21",
    summary:
      "Selected logo images fit inside the Fabric logo box with object-contain padding (no intentional crop). Logo candidates carry role hints (wordmark, icon mark, favicon/social preview) so ranking and UI can prefer header wordmarks over weak favicons when available. Favicons and compact icon marks may still be useful but need human review; production-quality logo upload remains recommended. Not print-ready asset validation.",
    accomplishments: [
      "`renderDesignSpecToFabric` — `fitImageContainInLayerBox`: natural dimensions via `getOriginalSize`, scale = min of width/height fit, ~12–18px padding, centered; `fitHint` for wordmarks vs icon marks.",
      "`logoRoleClassification.ts` + ranking penalties (e.g. failover HTML logo paths, favicon-only sets) — wordmarks/header logos rank above low-quality favicons when present.",
      "`LogoCandidatesReview` — role badges and cautious copy; “Best match” only on top candidate after re-rank.",
      "`prepareLogoCandidatesForUi` + optional `previewFetch` probe — deprioritize URLs that return HTML instead of image bytes.",
      "Proxied load unchanged (`/api/proxy-image`); placeholder remains on failure. PNG/SVG export behavior preserved.",
    ],
  },
  {
    id: 29,
    title: "Social footer and export filenames",
    status: "Complete",
    completed: "2026-05-21",
    summary:
      "Footer social links can render as compact platform marks with short labels on the canvas when selected (no remote icon assets). Exported PNG filenames can include business name and active design surface. Prototype polish only — not production file naming or brand guidelines.",
    accomplishments: [
      "`socialPlatformDisplay.ts` + `socialFooterItem` layers — badge glyphs (e.g. ▶, f, in) beside platform/path text; max 1–3 items with whole-item drop (no mid-handle truncation).",
      "`exportConceptFilename.ts` — slugified names such as `expoprint-canopy-tent-concept.png`; used by editor Export PNG/SVG and demo step-7 PNG.",
      "Contact line vs social rows split in `createDesignSpecFromIntake` — phone/email/address in text line; social as separate footer items.",
    ],
  },
  {
    id: 30,
    title: "Expanded evaluation and blocked-site signals",
    status: "Complete",
    completed: "2026-05-21",
    summary:
      "Ground-truth evaluation covers more public sites (ecommerce, marketing, consumer brand, large partial, blocked fetch). Flexible `anyArrayIncludes` checks tolerate services/products synonyms and field placement. Required checks pass on the current fixture set; nice-to-have warnings flag softer gaps (e.g. typography) without failing the script. Blocked static HTTP (e.g. 403) surfaces honest warnings, low quality, and manual-review missing assets — no browser automation and no invented services/products.",
    accomplishments: [
      "Fixtures added/updated: Shopify, Mailchimp, Patagonia, CVS (partial), Warby Parker (blocked `http_403`) in `data/extraction-eval-fixtures.json`.",
      "`anyArrayIncludes` check type in `evaluate-design-intake-api.mjs` — search `content.services` and/or `content.products` for synonym substrings.",
      "`websiteFetchBlocked.ts` — `site_blocked_static_fetch` warning, human line for manual/customer assets, `missingAssets` hints when blocked and content is low.",
      "`metadata.quality.overall` stays `low` when fetch is blocked and no useful logos/services/products were extracted.",
      "Documented in `docs/extraction-evaluation.md` and `docs/design-intake-api.md`. `npm run api:evaluate` — required checks passing across current fixtures; nice-to-have may warn without blocking.",
    ],
  },
  {
    id: 31,
    title: "Canvas social link display filter",
    status: "Complete",
    completed: "2026-05-22",
    summary:
      "Raw social URLs from the extract/analyze API can remain in metadata and intake fields, but the DesignSpec/canvas footer applies a prototype design-use filter: only clean official brand/profile handles render on the canvas. Generic video, share, and personal-profile links are dropped. Website/domain stays the primary footer item. Not a final brand-asset system — human review still required.",
    accomplishments: [
      "`filterSocialLinksForCanvasDisplay` in `socialPlatformDisplay.ts` — canvas-only filter; API response schema unchanged.",
      "Rejects generic YouTube `/watch`, `/shorts`, `/embed`, `/playlist`, share/intent/post/video paths, and similar non-profile URLs.",
      "Personal LinkedIn `/in/<person>` profiles are skipped unless the handle clearly matches the business name/domain.",
      "Accepts official brand handles when clean: X/Twitter, Instagram, Facebook, LinkedIn company, YouTube `@handle` / `/user/` / `/c/` / brand-like slugs.",
      "Compact badge + short handle display (e.g. `X /stripe`, `◎ @shopify`) — not full URLs; max 1–2 items on tent/expo surfaces with whole-item drop when space is tight.",
      "If no clean profile exists, social rows are omitted and the footer shows website/contact only.",
      "Shared through `createDesignSpecFromIntake` for `/` and `/demo`; Fabric editability and PNG/SVG export safety preserved (text/simple vector marks only).",
    ],
  },
  {
    id: 32,
    title: "Export filename polish",
    status: "Complete",
    completed: "2026-05-22",
    summary:
      "Concept export filenames can include business and active design-surface context where available, producing safer and more descriptive download names than a generic `expoprint-concept` default. Prototype naming only — not production file standards or brand guidelines.",
    accomplishments: [
      "`exportConceptFilename.ts` — `buildConceptExportFilename` slugifies business name and surface label (e.g. `shopify-canopy-tent-concept.png`).",
      "Falls back to category slug or `expoprint-concept` when business name is missing.",
      "Used by editor Export PNG/SVG and guided demo step-7 PNG download.",
      "NFKD normalization and character filtering keep filenames filesystem-safe.",
    ],
  },
  {
    id: 33,
    title: "Logo candidate quality and classification",
    status: "Complete",
    completed: "2026-05-22",
    summary:
      "Logo candidates now carry clearer role hints — wordmark, icon mark, favicon/social preview, marketing/header image, unknown — so ranking and review UI can prefer real brand marks over decorative header graphics and weak favicons. Shopify primary-logo paths are classified as wordmarks, not icon marks. Production-quality logo upload and validation remain recommended; not print-ready asset proofing.",
    accomplishments: [
      "`logoRoleClassification.ts` — distinguishes wordmarks, compact icon marks, favicons, `marketing_image`, `social_preview`, and unknown candidates.",
      "`logoCandidateRanking.ts` — primary logo assets and wordmarks rank above marketing/header graphics and low-quality favicons; marketing images can be excluded from top picks.",
      "Shopify `shopify-logo-primary-logo` and similar primary-logo paths classify as wordmark/full-logo candidates rather than icon marks.",
      "Favicons and compact icon marks may still be useful fallback marks but are not treated as full production logos.",
      "`LogoCandidatesReview` role badges and cautious copy on `/` and `/demo`; human confirmation still required before print.",
    ],
  },
  {
    id: 34,
    title: "Role-aware logo rendering and sizing on canvas",
    status: "Complete",
    completed: "2026-05-22",
    lastUpdated: "2026-05-22",
    summary:
      "Selected logos render through the safe image proxy when possible, with role-aware contain-fit inside the Fabric logo box: wide wordmarks can use more horizontal space; square/icon-style marks are capped smaller and centered. Placeholder fallback remains when proxy or image load fails. Prototype canvas behavior only — not production logo placement rules.",
    accomplishments: [
      "Proxied load unchanged (`/api/proxy-image` + `crossOrigin: anonymous`); remote URLs are not loaded directly into Fabric.",
      "`fitImageContainInLayerBox` — object-contain with padding; `fitHint` and `logoRole` drive layout.",
      "Wide wordmarks may use a larger rendered width; compact square/icon marks get a lower `logoMaxRenderedPx` cap and stay centered in the logo area.",
      "Shopify-style square primary logos no longer dominate the canvas when a wordmark-sized treatment is more appropriate.",
      "On proxy/image failure, dashed placeholder and label text remain — exports stay safe.",
      "Applies to `/` and `/demo` through shared DesignSpec generation.",
    ],
  },
  {
    id: 35,
    title: "Contextual color fallback handling",
    status: "Complete",
    completed: "2026-05-22",
    summary:
      "Empty or missing brand colors no longer silently fall back to the ExpoPrint navy/teal palette on unrelated sites. The style guide exposes clearer color-plan modes (default ExpoPrint fallback, neutral fallback, logo-color fallback, extracted brand colors, green-brand-light) so Google-style empty-color cases use a neutral/light treatment instead of looking like ExpoPrint branding. Shopify green/light behavior and intentional ExpoPrint styling are preserved.",
    accomplishments: [
      "`designStyleGuide.ts` — `colorPlanMode` on `ConceptColorPlan` and DesignSpec metadata (`colorPlanMode`, `colorBackground`, etc.).",
      "Modes include `defaultFallback` (ExpoPrint palette when appropriate), `neutralFallback`, `logoColorFallback`, `extractedBrandColors`, and `greenBrandLight` for black+green brands.",
      "When extracted brand colors are empty, concepts prefer neutral/light fallbacks rather than defaulting every site to ExpoPrint navy/teal.",
      "Shopify green brand-light plan and ExpoPrint’s own styling path remain available when context matches.",
      "Shared `buildConceptColorPlan` path for `/` and `/demo`; not ICC/spot-color production color management.",
    ],
  },
  {
    id: 36,
    title: "Evaluation coverage for logo and canvas regressions",
    status: "Complete",
    completed: "2026-05-22",
    summary:
      "Ground-truth evaluation fixtures and checks were extended to catch logo-quality and classification regressions — including Shopify primary-logo URL and wordmark role expectations. Required checks pass across the current fixture set (`npm run api:evaluate`). Prototype harness only — not a full production QA suite; no browser automation.",
    accomplishments: [
      "`data/extraction-eval-fixtures.json` — Shopify fixture checks top logo candidate URL substring (`shopify-logo-primary-logo`) and `logoRole: wordmark`.",
      "Expanded fixture set (Shopify, Mailchimp, Patagonia, CVS partial, Warby Parker blocked) with required vs nice-to-have severities.",
      "`npm run api:evaluate` — 52/52 required checks passing on current fixtures; nice-to-have warnings for softer gaps (e.g. typography) without failing the script.",
      "Does not change extract API schema, scraping, or Fabric behavior — validation tooling only.",
    ],
  },
  {
    id: 37,
    title: "Historical extraction evaluation (Metabase CSV)",
    status: "Complete",
    completed: "2026-05-22",
    lastUpdated: "2026-06-04",
    summary:
      "Historical evaluation workflow lives inside this ExpoPrint prototype (not a separate repo): local Metabase CSV exports → URL candidate extraction → limited website extraction via the same pipeline as `POST /api/design-intake/extract`. Partner exports and run outputs stay gitignored; no Metabase/DB connection.",
    accomplishments: [
      "**Milestone 1 (URL candidates)** — `npm run eval:urls` scans `first_req_description`, `first_req_note`, and `project_title` (plus direct URL columns when present); conservative bare-domain parsing; email masking to reduce false positives; per design-service row dedupe on normalized URL. On a real local export: 15,228 rows read; 1,522 rows with URL candidates; 13,706 without; 2,226 total candidates; 2,001 unique domains (aggregate counts only — no partner URLs in docs).",
      "**Milestone 2 (limited extraction)** — `npm run eval:extract` selects a capped sample (domain dedupe, offset/limit, delay between requests), calls shared `runDesignIntakeExtract`, writes `data/eval/runs/extraction_run_<timestamp>.jsonl` and `data/eval/results/extraction_summary_<timestamp>.csv`. Smoke test: 3 historical URLs, all successful, ~41s total.",
      "**Partner-data safety** — `data/private/**`, `data/eval/runs/**`, and `data/eval/results/**` gitignored; `npm run check:partner-data`; optional `./scripts/install-git-hooks.sh` pre-push guard. Only fake example CSV committed under `data/eval/`.",
      "`docs/evaluation/historical-extraction-evaluation.md`, `data/eval/README.md`, `scripts/eval/` (normalize/run/score CLIs, `eval:historical` dry-run harness). Extract API contract unchanged.",
    ],
  },
  {
    id: 38,
    title: "Historical extraction comparison and scoring",
    status: "Planned",
    summary:
      "Compare ExpoPrint extraction outputs to historical project and design-service fields from Metabase exports — automated scoring plus human review using the existing rubric in `docs/evaluation/historical-extraction-evaluation.md`.",
    accomplishments: [
      "Build on Milestones 1–2: URL candidates CSV → limited `eval:extract` runs → field-level comparison against stored historical values.",
      "Extend `scripts/eval/` scoring workflow (`scoreHistoricalExtraction`, `eval:historical`) beyond dry-run scaffolding.",
      "No Metabase/DB integration; partner CSVs and scored outputs remain local and gitignored.",
    ],
  },
  {
    id: 39,
    title: "Visual brand-audit evaluation viewers",
    status: "Complete",
    completed: "2026-06-12",
    lastUpdated: "2026-06-19",
    summary:
      "Historical evaluation is unified on `/internal/eval`: local dev reads real gitignored eval files; production is password-protected and reads published sanitized JSON only. The brand-audit workflow now covers 191 unique processed sites with improved palette extraction (colors coverage 79% on successful rows, up from a 14% baseline). Logo-derived palette fallback merges near-duplicate swatches into 3–4 brand-relevant colors. Batch tooling skips already-processed URLs by default, prioritizes root/homepage URLs, and auto-publishes when combining batches.",
    accomplishments: [
      "**Canonical `/internal/eval` viewer** — One UI for local and deployed eval review; local reads gitignored runs/results; deployed reads sanitized published JSON behind password protection only.",
      "**Brand-audit views** — Gallery cards and dense tables for logos, palettes, emails, phones, social links, products/services, and summaries; status column first; domain + path source URLs; expandable row details; column show/hide; palette source/confidence columns and raw→distinct color stats on logo-derived palettes.",
      "**URL inventory (All URLs)** — 1,415 sanitized candidate sites published; 191 matched processed rows, 1,224 not run; processed / not-run / failed status; search, status filters, and field-missing filters; recently processed rows first; canonical www/non-www dedupe with duplicate source URLs in expanded details.",
      "**Historical audit scale** — 191 unique processed sites (177 successful, 14 failed) after combining 18 batch review queues and deduplicating by canonical site; review queues regenerated from existing JSONL runs where possible without re-fetching websites.",
      "**Palette / color extraction** — Colors field coverage on successful rows: 14% baseline → 71% (prior checkpoint) → 79% latest (+65 pts from baseline; +8 pts since 71%). Logo-derived fallback when explicit palettes are missing; perceptual merge of near-duplicate colors (LAB ΔE); cap at 3–4 brand-relevant swatches; limit duplicate neutrals; track palette source, confidence, and raw vs distinct color counts.",
      "**Current field coverage (successful rows, 177)** — business name and logo 100%; colors 79%; email 50%; phone 58%; social links 64%; address/location 53%; products/services and summary 95%.",
      "**Batch processing** — `eval:extract-and-review` runs extraction, builds review queue, combines batches, and auto-publishes when `--combine` is used; default selection is not-run URLs only; `--retry-failed` and `--reprocess` are explicit; root/homepage URL priority; `--root-only` and `--preserve-order` flags.",
      "**Benchmark snapshots** — `eval:snapshot` records aggregate field-coverage checkpoints in `data/eval/benchmarks/coverage_snapshots.json` with percentage-point deltas for `/progress` trend tracking.",
      "**Publishing and safety** — `eval:publish-latest-internal` (+ optional URL inventory); `npm run check:partner-data`; raw partner exports and generated eval runs/results stay gitignored; only sanitized `data/eval/public/` artifacts are deployable.",
      "**URL deduplication** — Shared normalization from Metabase extraction through batch selection, combined queues, publish sanitization, and defensive UI dedupe.",
      "`docs/evaluation/historical-extraction-evaluation.md` and `data/eval/README.md` updated. Extract API contract unchanged.",
    ],
  },
  {
    id: 40,
    title: "Contact extraction and scrape-depth diagnostics",
    status: "Complete",
    completed: "2026-06-22",
    summary:
      "Improves contact field extraction in the shared website scrape pipeline (mailto/tel, JSON-LD Organization/LocalBusiness, footer excerpts) and adds scrape-depth diagnostic codes so low page counts and blocked/partial fetches are easier to interpret in API metadata.",
    accomplishments: [
      "**Structured contact signals** — JSON-LD email/telephone/PostalAddress parsing; footer/contentinfo text excerpts; mailto/tel normalization (lowercase emails, deduped phone formats).",
      "**Social link quality** — Brand-profile filter at scrape and API response (rejects share/watch/post/personal paths); raw discovered social URLs preserved in `websiteFetch.socialLinksDiscovered`.",
      "**Scrape-depth diagnostics** — `websiteFetch.scrapeDepthDiagnostics` codes: `blocked`, `timeout`, `body_truncated`, `pages_failed`, `no_same_domain_links`, `no_contact_pages_found`, `scrape_depth_low`; mirrored in `metadata.warnings`.",
      "**Evaluation fixtures** — ExpoPrint email (nice-to-have), Shopify official social links, CVS partial/body_truncated warnings; `contactFieldNormalize` unit tests.",
      "No Fabric canvas or layout changes. Extract API contract additive only.",
    ],
  },
];

function StatusBadge({ status }: { status: StageStatus }) {
  const styles =
    status === "Complete"
      ? "bg-emerald-100 text-emerald-800"
      : status === "In progress"
        ? "bg-amber-100 text-amber-900"
        : "bg-zinc-200 text-zinc-700";
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}
    >
      {status}
    </span>
  );
}

function EvaluationBenchmarkPanel() {
  const benchmark = loadCoverageBenchmarkSummary(process.cwd());
  if (!benchmark) return null;

  const { latest, deltaSummary, snapshotCount } = benchmark;
  const colors = latest.field_coverage.colors;
  const offerings = latest.field_coverage.products_services;

  return (
    <div className="mt-4 max-w-2xl rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm leading-relaxed text-zinc-700 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        Evaluation benchmark
      </p>
      <p className="mt-2 text-sm text-zinc-600">
        Latest coverage snapshot ({snapshotCount} checkpoint
        {snapshotCount === 1 ? "" : "s"}) from{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
          {latest.source_review_queue}
        </code>
        — {latest.successful_rows} successful extractions of {latest.total_rows}{" "}
        review rows.
      </p>
      <p className="mt-2 text-sm text-zinc-600">
        {COVERAGE_SNAPSHOT_FIELD_LABELS.colors}: {colors.percent}% ·{" "}
        {COVERAGE_SNAPSHOT_FIELD_LABELS.products_services}: {offerings.percent}%
      </p>
      {deltaSummary ? (
        <p className="mt-2 text-sm text-zinc-700">
          <strong className="font-medium text-zinc-900">Since prior checkpoint:</strong>{" "}
          {deltaSummary}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-zinc-500">
        Aggregate metrics only — record with{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
          npm run eval:snapshot
        </code>
        . Deltas use percentage points (e.g. 14% → 21% is +7 pts).
      </p>
    </div>
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
            Stages completed so far and planned next steps.{" "}
            <strong className="font-medium text-zinc-800">Phase 1 (client direction)</strong>{" "}
            is a structured design-intake extraction API for ExpoPrint’s system — not only a
            canvas demo. Stages 20–30 cover the extract API contract, `/api-docs` / `/api-test`,
            canvas bullet layout, fixture-based evaluation, reliability/quality metadata,
            large-site partial extraction, stale intake reset on URL change, logo contain-fit
            and role-aware ranking, social footer/export polish, and blocked-site warnings; Stages
            31–37 add canvas social display filtering, export filename polish, logo classification
            and role-aware sizing, contextual color fallbacks, expanded evaluation checks, and
            historical Metabase CSV evaluation (URL candidates + limited extraction); Stage 39
            adds the unified `/internal/eval` brand-audit workflow (gallery, table, All URLs
            inventory), combined review queues, coverage and scrape-depth metrics, batch
            processing refinements, URL deduplication, publish flow, and color/palette diagnostics;
            Stage 38 plans
            comparison/scoring against historical fields; the
            editor and guided demo remain visual test harnesses. A written
            work log lives in{" "}
            <code className="rounded bg-zinc-200/80 px-1 py-0.5 font-mono text-xs">
              docs/work-log.md
            </code>{" "}
            for Clockify-style time entry notes.
          </p>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            <strong className="font-medium text-zinc-700">Completed</strong> is the first
            functional milestone; <strong className="font-medium text-zinc-700">Last updated</strong>{" "}
            appears when a stage was refined later. Dates come from{" "}
            <code className="rounded bg-zinc-200/80 px-1 py-0.5 font-mono text-xs">
              docs/work-log.md
            </code>{" "}
            and git history.
          </p>
          <div className="mt-4 max-w-2xl rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm leading-relaxed text-zinc-700 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Deployment status (prototype)
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              This prototype deploys on <strong className="font-medium text-zinc-900">Vercel</strong> only,
              from the <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">main</code> branch.
              Railway is not used for this project anymore.
            </p>
            <ul className="mt-2 list-disc space-y-1.5 pl-4 marker:text-zinc-400">
              <li>
                <strong className="font-medium text-zinc-900">Vercel</strong> — current demo URL; production
                branch is{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">main</code>.
              </li>
              <li>
                <strong className="font-medium text-zinc-900">Git</strong> — only{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">main</code>; former{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">staging</code> and{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">vercel-deploy</code>{" "}
                branches were removed.
              </li>
              <li>
                <strong className="font-medium text-zinc-900">Before you push</strong> — keep{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">main</code> demo-ready;
                pushes to{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">main</code> deploy on
                Vercel.
              </li>
            </ul>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
              Verified on Vercel (`main`)
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-zinc-600 marker:text-zinc-400">
              <li>Claude Analyze Website works</li>
              <li>Multi-page scraping works</li>
              <li>Logo candidates show up</li>
              <li>Selected logo appears on the canvas through the proxy</li>
              <li>
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">/demo</code> guided view
                works
              </li>
              <li>
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">/progress</code> reflects
                the current deployment setup
              </li>
              <li>
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
                  POST /api/design-intake/extract
                </code>{" "}
                (Phase 1 integration contract)
              </li>
              <li>
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">/api-docs</code>{" "}
                and{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">/api-test</code>{" "}
                for local and deployed API smoke tests
              </li>
              <li>
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs">
                  npm run api:evaluate
                </code>{" "}
                — ground-truth fixture checks (local dev server; required checks passing)
              </li>
              <li>
                Partial large-page extraction (e.g. cvs.com) and editor/analyze alignment with
                the extract API — prototype only, not full browser automation
              </li>
              <li>
                Stale intake clears when website domain changes; logo contain-fit on canvas;
                expanded `npm run api:evaluate` fixtures — prototype only, human review required
              </li>
              <li>
                Canvas social display filter (brand handles only; generic video/share URLs omitted);
                role-aware logo sizing; contextual color fallbacks — not production-final
              </li>
            </ul>
          </div>
          <EvaluationBenchmarkPanel />
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
                <StageDates
                  status={stage.status}
                  completed={stage.completed}
                  lastUpdated={stage.lastUpdated}
                />
                <p className="mt-3 text-sm leading-relaxed text-zinc-600">{stage.summary}</p>
                <details className="mt-4 border-t border-zinc-100 pt-4">
                  <summary className="cursor-pointer text-sm font-medium text-zinc-600 hover:text-zinc-900">
                    View accomplishments
                  </summary>
                  <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-zinc-700 marker:text-zinc-400">
                    {stage.accomplishments.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </details>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
