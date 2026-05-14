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

**Optional Claude analyze route (prototype)**  
Prepared first optional Claude-backed Analyze Website route with mocked fallback; no real website scraping yet. Server-only `POST /api/analyze-website` reads `ANTHROPIC_*` from env; UI falls back to the prior mock extraction when the key is missing or the response is invalid. Keys never sent to the browser. **Debug:** responses include `source`, `claudeAttempted`, `durationMs`, and `model` (no secrets); dev server logs `[analyze-website]` with `hasApiKey` / outcome only.

---

## Later (planned)

Stages 8–11 on `/progress`: AI-assisted intake, real website extraction, team-facing brief generation, AI-generated DesignSpec — not started; log new dates here as work begins.
