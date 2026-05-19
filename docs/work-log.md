# ExpoPrint AI prototype — work log

Short dated notes for **Clockify**-style descriptions. Copy lines into time entry descriptions as needed.

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

---

## Later (planned)

Stages 9–12 on `/progress`: see `/progress` for the live list. Stage 10 documents a cautious homepage-only slice; Stages 13–14 cover the guided `/demo` intake and the prototype style-guide color normalization for generated concepts; broader AI-assisted intake, full-site extraction, production-ready brief workflow, and AI-generated DesignSpec remain mostly future work — log new dates here as that begins.
