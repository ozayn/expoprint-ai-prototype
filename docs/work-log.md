# ExpoPrint AI prototype — work log

Short dated notes for **Clockify**-style descriptions. Copy lines into time entry descriptions as needed.

Dates on `/progress` are taken from this file and from `git log` for the related commits. If a stage date is unknown, the UI shows **Date: Not recorded yet** — do not guess.

---

## Template (new entries)

Use one block per slice of work. Include the stage number so `/progress` can stay aligned.

```markdown
## YYYY-MM-DD

**Short title (Stage N)**  
One-sentence summary. Optional bullets for Clockify detail.
```

Example:

```markdown
## 2026-05-20

**Dual deployment — Railway + Vercel (Stage 18)**  
Vercel config and deploy badge; later moved to Vercel-on-`main` only (Railway removed).
```

---

## 2026-05-12

**Fabric editor prototype (Stage 1)**  
Next.js + TypeScript + Tailwind; client-only Fabric.js; 1000×600 canvas; “Generate Sample Concept” with background, polygon accent, logo placeholder, headline/supporting/website text; export JSON / PNG / SVG; load JSON; textarea sync.

**DesignSpec + renderer (Stage 2)**  
Defined `DesignSpec` / layer types in `src/lib/designSpec.ts`; `sampleDesignSpec`; `renderDesignSpecToFabric` to build Fabric objects from spec.

**Local dev + docs**  
`scripts/dev.sh`, `npm run dev:local`; README local URL note.

**Deployment (Stage 3)**  
Repository on GitHub; prototype deployed on Railway.

**Demo polish + Fabric fixes (Stage 4)**  
Canvas init / Strict Mode handling; canvas status line; primary button contrast; “What this proves” sidebar; Fabric `originX`/`originY` top-left defaults in renderer; preview `cssOnly` scaling with full-size exports.

**Design intake state / debugging milestone (Stage 5)**  
Controlled intake fields; checkbox and dropdown handlers updating nested state; `computeDesignBriefText` for brief body from current selections; `createDesignSpecFromIntake` + `shouldUseIntakeDesignSpec` so sample concept can follow intake after mock “Analyze Website” data; style presets tweak canvas layout (accent opacity/size/rotation, centered text for Traditional); live “Selected for design” summary. Still mock extraction and hand-authored spec mapping — no scraper, no LLM, not a production brief pipeline.

**Intake-driven canvas and design surfaces (Stage 6)**  
Intake state drives `createDesignSpecFromIntake` into Fabric: business name, domain, supporting copy from selected services/products/components (per mapper rules), brand hexes from extracted colors when selected, optional contact/footer line from selected phone/email/social/booth address with tight truncation. “Design surfaces” tabs for checked components; single canvas; active surface updates `productType` / `templateId` on generate. Async-safe refs for generate; canvas source hint in UI. Editable layers; JSON/PNG/SVG exports unchanged at 1000×600. Real scraping and AI-driven generation still out of scope for this prototype slice.

**Demo layout and mobile clarity pass (Stage 7)**  
Home layout only: clearer A→B→C vs. D column grouping (intake / extracted / brief vs. concept preview), generate + surfaces next to canvas, export/import + raw JSON behind collapsed details, shorter muted helper copy, mobile-friendly spacing. No new generation logic; Fabric behavior and 1000×600 exports unchanged.

**Claude / Anthropic env prep**  
`.gitignore` tightened for env files with `!.env.example`; added `.env.example` (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`) and README “Environment variables” for `.env.local` vs Railway.

**Optional Claude-backed Analyze Website (Stage 8)**  
Server-only `POST /api/analyze-website` (Anthropic SDK); key and model from env only; Claude returns structured extracted rows from intake hints and optional single-homepage HTML context (Stage 10); no full-site crawl. UI and Network show whether Claude or mock fallback ran; JSON includes `source`, `claudeAttempted`, `model`, `durationMs`, `reason` on failure, and `websiteFetch` (status, counts, no raw page) — no secrets in responses or dev logs beyond `hasApiKey` / outcome. Mock extraction unchanged when the key is missing, the API errors, or the model JSON is unusable. Confirmed locally with `ok: true` and `source: claude` when configured. Not full AI design generation; `/progress` Stages 8 and 10 summarize scope cautiously.

**Homepage content for Analyze (Stage 10, prototype)**  
Added first homepage-only website content extraction for Claude context (`src/lib/server/extractWebsiteContent.ts`): single public URL GET with timeout and byte cap, cheerio-based title/meta/OG/link/text heuristics; `websiteFetch` metadata on `/api/analyze-website` responses (no raw HTML body). No full crawling, no headless browser, not production-validated.

**Guided customer-style demo view (Stage 13)**  
New `/demo` route: minimal guided intake (one question per step) for a cleaner demo narrative while `/` stays the full Fabric editor with exports and existing prototype tools. Same intake model, Claude/mocked analyze API, brief computation, intake-driven DesignSpec, and Fabric renderer at 1000×600 with scaled preview and surface tabs; links between home and demo for “Open guided demo” / “Open editor view.” Guided flow is now **seven** steps: business name is edited after Analyze (review step), not as an early required field—still prototype-grade, not a production intake.

**Style guide layer for generated concepts (Stage 14)**  
Prototype design-style layer: extracted brand colors are normalized before use on the editable Fabric canvas; bright palettes are treated as accents; concepts prioritize contrast, readability, and cleaner large-format-print composition. Implemented in `designStyleGuide.ts` / `buildConceptColorPlan` / `createDesignSpecFromIntake` for `/` and `/demo` — not ICC/spot-color production logic.

**Small multi-page website extraction (Stage 15)**  
Server-side `extractWebsiteContent`: after a successful homepage GET, same-domain `<a href>` targets are ranked by simple keyword heuristics (about, services, products, solutions, contact, work, portfolio, menu, locations, etc.); up to three additional HTML pages are fetched (no recursion, no headless browser). Per-page title/meta/OG, mailto/tel/social, logo-ish image URLs, and capped visible text are merged with deduping; total visible excerpt budget for Claude is capped (~18k chars). `/api/analyze-website` returns extended `websiteFetch` metadata (`pagesAttempted`, `pagesFetched`, `pagesFailed`, `pageTypesFound`, `textChars`); raw page bodies are never exposed in API JSON. UI can show “N pages inspected” when `pagesFetched` ≥ 2.

**Extracted Services / Products cleanup (staging)**  
Added `src/lib/extractedValueCleanup.ts` and wired it into `buildExtractedFromPlainValues` so every extracted row is normalized after Claude returns. Services/Products are split on `,;·•|`, each item is trimmed of empty parens, repeated punctuation, navigation tokens (`Home`, `Menu`, …), and items shorter than 3 characters unless explicitly meaningful (`AI`, `3D`, `10x10`); deduped case-insensitively and capped at ~6 items. Free-text fields (logo / address / social / brand colors) get a lighter pass; phone/email use stricter checks. Claude system prompt also tightened: services / products must be a single comma-separated readable line (≤6 items) or `""`. Verified live against `https://expoprint.io/` (4 pages inspected) — Services and Products both render as clean phrases instead of garbled fragments. No new AI calls; multi-page fetch limits unchanged; raw scraped text still never exposed to the UI.

**Selected logo rendering via safe proxy (Stage 17, staging)**  
Added `GET /api/proxy-image?url=...` — a server-side image proxy for selected logo candidates (`http:`/`https:` only, public-IP DNS checks, timeout, size cap, image MIME whitelist). Selected candidates can appear in the Fabric logo area when the proxy fetch succeeds; remote logos are not loaded directly from third-party domains (same-origin proxy + `crossOrigin: "anonymous"`). `DesignSpec` `image` layer + async `FabricImage.fromURL`; logo is fitted inside the existing placeholder with aspect ratio preserved and remains editable. On proxy/image failure, the safe placeholder and label text stay — not every remote logo will always load. PNG export is intended to stay CORS-clean through the proxy when load succeeds (prototype, not print-ready proofing). SVG may reference the proxied URL per Fabric `toSVG()` — not final production asset handling. Production-quality logo upload/validation still needed later; `/progress` Stage 17 and `LogoCandidatesReview` copy reflect cautious expectations. `/` and `/demo` share the same DesignSpec path.

**Dual deployment — Railway + Vercel (Stage 18, historical)**  
Originally split hosting: Railway on **`main`**, Vercel config on a separate **`vercel-deploy`** branch (`vercel.json`, API `maxDuration`, CSP when `VERCEL=1`, `DeployPlatformBadge`, `docs/vercel-deploy.md`). Later simplified: Railway removed, extra branches deleted, **Vercel deploys from `main`** — see “Deployment — Vercel on `main` (current)” below.

**Logo candidate extraction and review (Stage 16, staging)**  
Server `parseHtmlToPageSummary` now collects a structured list of logo candidates per page: `link rel=icon`, `link rel=apple-touch-icon(-precomposed)`, `meta og:image`, `<header>`/`<nav>` `<img>` tags, and `<img>` with `logo` in alt/src/class/id. Each candidate is normalized to an absolute URL with a `source` label and optional `alt` / `width` / `height`; deduped across the inspected pages and capped at 6 for the UI (`websiteFetch.logoCandidatesList`). `DesignIntakeState` carries `logoCandidates` + `selectedLogoCandidateUrl`; `applyClaudeAnalyzeSuccessToIntake` parses + sanitizes the list, drops a stale selection when a fresh analyze returns a different list, and the editor + `/demo` Step 6 render the same compact `LogoCandidatesReview` grid inside `Review identity` (failed image loads fall back to a small `N/A` placeholder; selected candidate exposes a `Clear` action). Canvas signals selection conservatively — the existing dashed logo placeholder switches to a solid stroke and the label opacity nudges from 0.45 → 0.72; no remote image is loaded into Fabric so PNG/SVG export remains untainted. Brief includes the selected candidate URL with a reminder that a production-quality logo upload is still needed. CSP `img-src` widened to allow `https:` (data/blob/`'self'` + https) so external favicons / og:images render in previews. Verified locally on `expoprint.io` (3 candidates: icon, og:image, header-image with alt + 170×53 SVG) and `stripe.com` (14 surfaced; 6 returned including favicon, apple-touch-icon, og:image, img-logo with alt). No new AI calls; multi-page fetch limits unchanged; raw HTML still never exposed to the UI.

---

## 2026-05-13

**Design intake state (Stage 5)**  
Controlled intake fields, mock analyze path, brief from selections, live “Selected for design” summary.

**Intake-driven canvas and design surfaces (Stage 6)**  
`createDesignSpecFromIntake`, design-surface tabs, contact/footer line on canvas; still mock extraction.

---

## 2026-05-14

**Demo layout and mobile clarity (Stage 7)**  
Home layout grouping, collapsed export JSON, mobile spacing; no generation logic changes.

**Optional Claude Analyze Website (Stage 8)**  
`POST /api/analyze-website`, env-only API key, mock fallback, cautious response metadata.

**Homepage content for Analyze (Stage 10)**  
`extractWebsiteContent.ts` — single homepage GET, cheerio heuristics, `websiteFetch` on API JSON.

**Guided customer-style demo (Stage 13)**  
`/demo` route, seven-step guided intake; links to full editor on `/`.

**Style guide layer (Stage 14)**  
`designStyleGuide.ts` / `buildConceptColorPlan` — normalized palettes and contrast on canvas.

---

## 2026-05-19

**Small multi-page website extraction (Stage 15)**  
Homepage plus up to three same-domain pages; capped text budget for Claude.

**Logo candidate extraction, ranking, and review (Stage 16)**  
Structured `logoCandidatesList` (score + transparency metadata), ranked for SVG/transparent preference; `LogoCandidatesReview` on `/` and `/demo`.

**Selected logo rendering via safe proxy (Stage 17)**  
`GET /api/proxy-image`, DesignSpec `image` layer, async Fabric load with placeholder fallback.

---

## 2026-05-20

**Dual deployment — Railway + Vercel (Stage 18)**  
`vercel-deploy` branch, `vercel.json`, deploy badge on `/`, `docs/vercel-deploy.md`; Railway on `main` (since superseded — see below).

**Design-intake extraction API — Phase 1 direction (Stage 19, in progress)**  
Client feedback reframes Phase 1 as an API deliverable: input a customer website URL (plus optional product category, components, and instructions) and return normalized design-intake JSON for ExpoPrint’s existing system. The stable contract is **not finished** — today’s `POST /api/analyze-website` is a prototype route (bounded scrape + optional Claude + mock fallback) that powers the in-app intake model. The `/` editor and `/demo` remain demo/test harnesses; Fabric canvas and DesignSpec exports are visualization consumers, not assumed to be the final integration output. Next: define versioned response schema, map current extraction fields into `business` / `brand` / `content` / `designIntake` / `metadata`, and keep public JSON free of raw HTML or full-page text.

**Target response shape (sketch — not implemented as-is yet):**

```json
{
  "business": {
    "name": "ExpoPrint",
    "website": "https://expoprint.io",
    "domain": "expoprint.io"
  },
  "brand": {
    "colors": ["#0B2E4A", "#2BB3A3"],
    "logoCandidates": []
  },
  "content": {
    "services": [],
    "products": [],
    "contact": {
      "phone": "",
      "email": "",
      "social": []
    }
  },
  "designIntake": {
    "recommendedHeadline": "",
    "recommendedSupportingText": "",
    "missingAssets": [],
    "confidenceNotes": [],
    "needsHumanReview": true
  },
  "metadata": {
    "source": "scraper_plus_claude",
    "pagesInspected": 0,
    "warnings": []
  }
}
```

---

## Deployment — Vercel on `main` (current)

- **Vercel only** — production/demo deploys from Git branch **`main`**.
- **Railway** — not used for this project anymore (services removed).
- Git branches **`staging`** and **`vercel-deploy`** deleted; only **`main`** remains.
- **Rule:** keep `main` demo-ready before push.

**Verified on Vercel (`main`):** Claude Analyze Website; multi-page scraping; logo candidates (ranked, transparency-aware); selected logo on canvas via proxy; `/demo` guided view; `/progress` deployment status current.

---

## Later (planned)

Stages 9–12 on `/progress`: see `/progress` for the live list. Stage 10 documents a cautious homepage-only slice; Stages 13–18 cover guided `/demo`, style-guide colors, multi-page extraction, logo candidate review, proxied logo rendering, and Vercel deployment on `main`. **Stage 19 — Design-intake extraction API (in progress):** stable ExpoPrint-facing JSON contract; prototype `POST /api/analyze-website` may evolve into that API; UI stays a harness. Broader AI-assisted intake, full-site extraction, production-ready brief workflow, and AI-generated DesignSpec remain future — log new dates here as that begins.
