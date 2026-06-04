# ExpoPrint AI prototype — work log

Short dated notes for **Clockify**-style descriptions. Copy lines into time entry descriptions as needed.

Dates on `/progress` are taken from this file and from `git log` for the related commits. Each complete stage shows **Completed** (first functional milestone) and, when applicable, **Last updated** (later refinements). If a stage date is unknown, the UI shows **Date: Not recorded yet** — do not guess.

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
Structured `logoCandidatesList` (score + transparency metadata); ranking prioritizes header/nav wordmarks and brand-matched logo images over small favicons (transparency is a minor bonus, not the primary signal). `LogoCandidatesReview` on `/` and `/demo`.

**Selected logo rendering via safe proxy (Stage 17)**  
`GET /api/proxy-image`, DesignSpec `image` layer, async Fabric load with placeholder fallback.

---

## 2026-05-20

**Dual deployment — Railway + Vercel (Stage 18)**  
`vercel-deploy` branch, `vercel.json`, deploy badge on `/`, `docs/vercel-deploy.md`; Railway on `main` (since superseded — see below).

**Typography/font signal extraction (Stage 19)**  
Server parses font-family hints from HTML/CSS/Google Fonts links (no font file downloads). `websiteFetch.typography` exposes safe name lists + style guess; intake stores `typographySignals` for Fabric mapping via `typographyMapping.ts` (system/geometric/serif fallbacks). Claude context includes typography when available. Compact row in Review identity on `/` and `/demo`. Later polish: `typographyFontCleanup.ts` drops non-font tokens (`normal`, `400`, `700`, `1.0`, lengths); metadata counts match cleaned lists. Not exact production font matching.

**Design-intake extraction API contract — Phase 1 deliverable (Stage 20)**  
Client direction reframes Phase 1 as a structured API — not only a visual prototype. Implemented `POST /api/design-intake/extract`: accepts `websiteUrl` plus optional `productCategory`, `components`, `stylePreference`, and `customerInstructions`; returns normalized JSON sections `business`, `brand`, `content`, `designIntake`, and `metadata` (logo candidates, typography, services/products, contact, recommendations, scrape/Claude status, warnings). Reuses `runClaudeWebsiteAnalyze` (bounded multi-page scrape + Claude). No raw HTML or full scraped text in responses. `/` and `/demo` remain visual consumers via `POST /api/analyze-website`. Docs: `docs/design-intake-api.md`. Partial `ok: true` with `scraper_only` when Claude fails but scrape data exists. Not production-final; human review required.

**API docs and browser tester (Stage 21)**  
`/api-docs` explains the Phase 1 contract with a form-driven command builder (copyable `curl` using current origin on Vercel; `npm run api:test` for local dev). `/api-test` runs extract from the browser with summary + copyable JSON. `scripts/test-design-intake-api.sh` and `npm run api:test`. Verified on deployed Vercel. Prototype tooling only.

**Logo ranking polish — wordmarks over favicons (Stage 16 follow-up)**  
Updated `logoCandidateRanking.ts`: header/nav and brand-matched images rank above small square favicons; transparency bonus capped so an EX favicon does not beat a full ExpoPrint header SVG. Reason strings mention header/nav, wordmark proportions, favicon fallback, and small-icon penalties. Verified on `expoprint.io` and `google.com`.

**Bullet-list services/products on canvas (Stage 22)**  
`createDesignSpecFromIntake` can render selected services/products as up to four `•` lines in a multiline Textbox when layout rules allow (trade show booth, back/side wall, 3+ items); one-line ` · ` copy remains the fallback (e.g. canopy tent). `DesignSpec.metadata.contentLayout` records `bullet-list` vs `supporting-line`. Not a full template system.

**Earlier Phase 1 target shape (sketch — largely reflected in v1 extract API):**

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

## 2026-05-21

**API testing and extraction reliability (Stages 21–25 summary)**  
Browser `/api-test` runs `POST /api/design-intake/extract` on the current host with summary + copyable JSON. `/api-docs` form builds curl (page origin on Vercel) and local `npm run api:test`. Typography metadata uses cleaned font lists (non-font tokens filtered). `npm run api:evaluate` runs fixture required/nice-to-have checks (expoprint.io, google.com, stripe.com — required checks passing). Large sites can return partial head extraction (`status: partial`, `body_truncated`). Bare domains normalize to `https://` in API test/docs forms. Prototype-only — human review required; no full browser automation.

**Progress dates — Completed vs Last updated**  
`/progress` stages now show `Completed` and `Last updated` separately so first-ship dates stay visible when a stage is refined later.

**Logo candidate ranking and review UI (Stage 16)**  
`logoCandidateRanking.ts` prioritizes header wordmarks over favicons; `prepareLogoCandidatesForUi` hides weak candidates when a strong header loads; `LogoCandidatesReview` labels and shorter production reminders on `/`.

**Typography signals polish (Stage 19)**  
`typographyFontCleanup.ts` and metadata counts on `websiteFetch.typography` match cleaned font-family lists in API JSON.

**Phase 1 extract API + docs/tester (Stages 20–21)**  
`POST /api/design-intake/extract`, `/api-docs` (form-driven curl/npm), `/api-test`, and `npm run api:test` — shipped and smoke-tested on Vercel.

**Bullet-list layout + display copy (Stage 22)**  
Canvas bullet lists for services/products when layout rules allow; `supportingBulletText.ts` normalizes bullet phrases for sentence case while preserving brands, acronyms, and dimensions.

**Editor UI clarity (Stage 7 follow-up)**  
`/` main editor: long helper paragraphs replaced with `InfoTooltip` icons; `/demo` keeps guided step copy.

**Extraction quality evaluation harness (Stage 23)**  
Ground-truth fixture checks for `POST /api/design-intake/extract`: `data/extraction-eval-fixtures.json` (expoprint.io, google.com, stripe.com), `scripts/evaluate-design-intake-api.mjs`, `npm run api:evaluate`. Checks cover business identity, logo candidate source/ranking signals, typography `styleGuess`, services/products substrings, contact fields, and `metadata.pagesInspected`. **Required** vs **nice_to_have** severities — required failures exit nonzero; nice-to-have prints warnings only. Documented in `docs/extraction-evaluation.md`; linked from `/api-docs` and `README`. Lightweight prototype harness — not a full production QA suite. No change to scrape/Claude/Fabric behavior.

**Test sites reference**  
`docs/test-sites.md` — internal URL table and manual QA checklist for extraction/canvas review.

**Extraction reliability and evaluation checks (Stage 24)**  
Extract API: deterministic business-name fallbacks (`resolveBusinessName`), `metadata.quality` summary, structured warning codes (`missing_business_name`, `website_fetch_failed`, etc.). `npm run api:evaluate -- --runs N` for cross-run consistency. Lightweight prototype harness — not full production QA.

**API docs and browser tester — URL normalization (Stage 21 follow-up)**  
`/api-test` and `/api-docs` URL fields accept bare domains (`cvs.com`, `google.com`); `normalizeApiTestWebsiteUrl` prepends `https://` on blur/submit for POST payloads and generated curl/npm commands. Switched inputs from `type=url` to text so browsers do not block domain-only values. Helper copy under the field. Backend scrape validation unchanged. Prototype tooling only.

**Large-site partial extraction and editor/API alignment (Stage 25)**  
When homepage HTML exceeds the ~800 KB cap, the server parses a truncated prefix instead of failing completely: `websiteFetch.status: partial`, `reason: body_truncated`, warning `large_site_partial_extraction`. Example `cvs.com` can still return business name, typography, services/products, and head-derived logo candidates — not guaranteed for every large site. Editor `/` and `/demo` share `runClaudeWebsiteAnalyze` with `POST /api/design-intake/extract`; demo placeholder business name treated as unset in Claude prompts; partial fetch treated as valid extraction (not mock fallback). Favicon-only logos warned in API/UI/brief; safer head-only logo heuristics (JSON-LD, `og:logo`, header before generic `img-logo`). `npm run api:compare` for route smoke checks. No headless browser; human review still required; not production-final extraction reliability.

**Stale website intake reset (Stage 27)**  
`websiteIntakeReset.ts` clears website-specific fields when the typed URL domain differs from `lastAnalyzedDomain` (normalized hosts). Clears business name, extracted rows, logos, selected logo, typography, brief, and analyze notes; keeps category, components, style, and instructions. Works on `/` and `/demo` before the next Analyze. Analyze merge still updates identity on a new domain; partial responses can still set business name. Prototype UX — not production intake rules.

**Logo canvas fitting and candidate roles (Stage 28)**  
Object-contain logo fit in Fabric with padding (`fitImageContainInLayerBox`); role classification and ranking favor wordmarks over favicons when available; failover/bot-wall logo URLs deprioritized; `previewFetch` probes weak candidates. Favicons/icon marks remain optional with human review; production logo upload still recommended. Not print-ready validation.

**Social footer and export filenames (Stage 29)**  
Canvas social footer uses compact platform marks + short labels (`socialFooterItem`); export PNG/SVG names include business and surface slugs (`exportConceptFilename.ts`). No remote social icon assets.

**Expanded evaluation and blocked-site signals (Stage 30)**  
More fixtures (Shopify, Mailchimp, Patagonia, CVS partial, Warby Parker blocked); `anyArrayIncludes` for flexible services/products checks; `site_blocked_static_fetch` + missing-asset hints when static fetch is denied. Required checks pass on current fixture set; nice-to-have warnings only. No browser automation; API does not invent services/products when scrape is empty.

---

## 2026-05-22

**Canvas social link display filter (Stage 31)**  
DesignSpec/canvas footer applies `filterSocialLinksForCanvasDisplay` — raw social URLs may remain in API/intake metadata, but only clean brand/profile handles render on canvas. Rejects YouTube `/watch`, `/shorts`, `/embed`, `/playlist`, share/intent/video URLs, and personal LinkedIn `/in/` unless brand-related. Compact badge + short handle (e.g. `X /stripe`, `◎ @shopify`); max 1–2 on tent/expo; website/domain stays primary; omit social when nothing clean. Shared `/` + `/demo`. Prototype design-use filter — not a final brand-asset system; human review still required.

**Export filename polish (Stage 32)**  
`exportConceptFilename.ts` — slugified business + surface names (e.g. `shopify-canopy-tent-concept.png`); safer fallbacks than generic `expoprint-concept`. Editor PNG/SVG and demo step-7 PNG. Prototype naming only.

**Logo candidate quality and classification (Stage 33)**  
`logoRoleClassification.ts` — wordmark, icon mark, favicon/social preview, `marketing_image`, unknown. Ranking favors primary wordmarks over marketing/header graphics and weak favicons. Shopify primary-logo paths classify as wordmark, not icon mark. Favicons/icon marks remain optional fallbacks; production logo upload/validation still recommended.

**Role-aware logo rendering and sizing on canvas (Stage 34)**  
Proxied logo load when possible; role-aware contain-fit with `logoMaxRenderedPx` caps for compact square/icon marks; wider wordmarks use more horizontal space. Placeholder on proxy failure. Shopify square logos no longer dominate canvas inappropriately. Not production logo placement rules.

**Contextual color fallback handling (Stage 35)**  
Empty/missing brand colors no longer silently use ExpoPrint navy/teal on unrelated sites. `colorPlanMode`: `defaultFallback`, `neutralFallback`, `logoColorFallback`, `extractedBrandColors`, `greenBrandLight`. Google-style empty-color cases use neutral/light fallback; Shopify green and ExpoPrint styling preserved when context matches.

**Evaluation coverage for logo and canvas regressions (Stage 36)**  
Shopify fixture checks top logo URL (`shopify-logo-primary-logo`) and `logoRole: wordmark`. `npm run api:evaluate` — 52/52 required checks passing on current fixtures. Harness only — no browser automation; API schema unchanged.

**Historical extraction evaluation harness (Stage 37)**  
Added initial design/docs/scaffolding for historical extraction evaluation using Metabase CSV exports: `docs/evaluation/historical-extraction-evaluation.md`, `data/eval/` layout (gitignored partner CSVs and run outputs), `scripts/eval/` normalize/run/score CLIs, shared `runDesignIntakeExtract` helper, `npm run eval:historical` (default dry-run on example CSV). No Metabase/DB/API/UI changes.

---

## Deployment — Vercel on `main` (current)

- **Vercel only** — production/demo deploys from Git branch **`main`**.
- **Railway** — not used for this project anymore (services removed).
- Git branches **`staging`** and **`vercel-deploy`** deleted; only **`main`** remains.
- **Rule:** keep `main` demo-ready before push.

**Verified on Vercel (`main`):** Claude Analyze Website; multi-page scraping; logo candidates (wordmark-ranked, role-aware); selected logo on canvas via proxy with contain-fit and role-aware sizing; typography signals (cleaned) + canvas font mapping; stale intake reset on URL domain change; canvas social display filter (brand handles only; generic video/share URLs omitted); slugified export PNG names; contextual color fallbacks (neutral/light when brand colors missing); `POST /api/design-intake/extract` (Phase 1 contract); `/api-docs` and `/api-test` (bare-domain URL normalization); `npm run api:evaluate` (expanded fixtures, 52/52 required checks passing); partial large-page extraction smoke (e.g. cvs.com); blocked-site warnings on honest failures (e.g. Warby Parker — prototype only); `/demo` guided view; `/progress` current. Human review and production logo validation still required; social display is a prototype design-use filter; no full browser automation.

---

## Later (planned)

Stages 9–12 on `/progress`: see `/progress` for the live list. Stages 13–36 cover guided `/demo`, style-guide colors, multi-page extraction, logo candidate review, proxied logo rendering, Vercel on `main`, typography signals, Phase 1 extract API, API docs/test tooling, canvas bullet layout, fixture evaluation, reliability metadata, large-site partial extraction, stale URL intake reset, logo contain-fit and roles, social footer/export polish, expanded fixtures, blocked-site warnings, canvas social display filtering, export filename polish, logo classification and role-aware sizing, contextual color fallbacks, and evaluation checks for logo regressions. Not production-final. Future: versioned API, auth, browser-rendered extraction (Stage 26), production-ready brief workflow, AI-generated DesignSpec, full template system.
