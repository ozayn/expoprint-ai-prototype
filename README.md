This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### ExpoPrint local dev

From the project root, start the app with dependencies checked automatically:

```bash
npm run dev:local
```

The dev server runs at **http://localhost:3000**.

### Environment variables

Future Claude / Anthropic calls read configuration from the environment. The app stays fully usable without any API key; if the key is missing or Claude fails, **Analyze Website** still fills the form using the built-in mock extraction.

1. Copy `.env.example` to `.env.local` for local development.
2. Set `ANTHROPIC_API_KEY` in `.env.local` when you are ready to wire up the API (get a key from the Anthropic console).
3. Never commit `.env.local` or any file that contains real secrets (they are listed in `.gitignore`).
4. On **Vercel**, add `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`) in the project **Environment Variables** settings instead of putting keys in the repo.

**Deploy:** **Vercel only**, from the **`main`** branch (demo/production). Connect the Vercel project to `main`, set env vars — see [`docs/vercel-deploy.md`](docs/vercel-deploy.md). Keep `main` demo-ready before pushing; each push to `main` triggers a Vercel deploy. Railway is not used for this project anymore.

**Analyze Website:** With a valid key, “Analyze Website” calls `POST /api/analyze-website`: the server may **fetch the homepage once** (the URL in the form — no crawling), then Claude infers structured extracted fields. Without a key or on errors, the app uses the same mocked extraction as before.

### Phase 1 — design-intake extraction API (structured deliverable)

Per client feedback, **Phase 1** is framed as a **structured API deliverable** for ExpoPrint’s system — not only a visual Fabric prototype.

| Route | Role |
|-------|------|
| **`POST /api/design-intake/extract`** | Integration API — stable normalized JSON (`business`, `brand`, `content`, `designIntake`, `metadata`). Used by `npm run api:test`, `npm run api:evaluate`, and `/api-test`. See [`docs/design-intake-api.md`](docs/design-intake-api.md). |
| **`POST /api/analyze-website`** | UI-oriented analyze for the editor (`/`) and guided demo (`/demo`). Same underlying pipeline (`runClaudeWebsiteAnalyze`), different response shape. |

Both routes share one server extraction pipeline in `src/lib/server/claudeWebsiteAnalyze.ts` (scrape → logo/typography → Claude). Mapping to integration JSON vs. UI intake happens only after that shared step.

The home editor (`/`) and guided demo (`/demo`) are **visual consumers and test harnesses** for the same scrape + Claude pipeline. Responses do **not** include raw HTML or full scraped text. Logo candidates, typography, and Claude-inferred fields require **human review**; the contract is a **first stable v1**, not production-final.

**Verify extract API (local):**

```bash
npm run api:test -- https://expoprint.io
npm run api:test -- https://stripe.com "Trade show booth" "Conservative"
```

**Ground-truth evaluation (fixtures):** with the dev server running, `npm run api:evaluate` runs checks in [`data/extraction-eval-fixtures.json`](data/extraction-eval-fixtures.json) against `POST /api/design-intake/extract`. Use `npm run api:evaluate -- --runs 3` for consistency across repeated calls. Responses include `metadata.quality` and reliability warning codes. See [`docs/extraction-evaluation.md`](docs/extraction-evaluation.md). Manual URL list: [`docs/test-sites.md`](docs/test-sites.md).

See [`docs/design-intake-api.md`](docs/design-intake-api.md) for the full contract. **Local docs page:** [http://localhost:3000/api-docs](http://localhost:3000/api-docs) (copyable curl and `npm run api:test` commands).

**Verify Analyze / Claude (manual):**

1. Open DevTools → **Network**, filter by `analyze-website`.
2. Click **Analyze Website** on the home page.
3. Inspect the JSON response: `ok`, `source`, `claudeAttempted`, `websiteFetch` (`status`, optional `reason`, `finalUrl`, counts), `durationMs`, and `reason` (on failures). With a key and a good model response you should see `ok: true`, `source: "claude"`, `claudeAttempted: true`.
4. Read the **status line** under the button (e.g. “Claude extraction used.” vs “Using mocked extraction: …”).
5. With `npm run dev`, check the **server terminal** for `[analyze-website]` lines (development only): `hasApiKey`, `model`, outcome — never the secret key.

### Project progress and work log

- **Roadmap / stages:** [http://localhost:3000/progress](http://localhost:3000/progress) (**Stage 20 — Design-intake extraction API contract**, Stage 19 typography, and earlier milestones).
- **Clockify-style notes:** see [`docs/work-log.md`](docs/work-log.md).

Alternatively, run the development server directly:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
