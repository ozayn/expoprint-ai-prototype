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
4. On Railway, add `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`) in the project **Variables** tab instead of putting keys in the repo.

**Railway build (Node version):** Next.js 16 needs **Node 20+**. This repo pins Node **22** via `.nvmrc`, `package.json` `engines`, and `nixpacks.toml`. If a deploy still uses Node 18, set Railway variable `NIXPACKS_NODE_VERSION=22` (or `RAILWAY_NODE_VERSION=22`), clear the build cache, and redeploy.

**Analyze Website:** With a valid key, “Analyze Website” calls `POST /api/analyze-website`: the server may **fetch the homepage once** (the URL in the form — no crawling), then Claude infers structured extracted fields. Without a key or on errors, the app uses the same mocked extraction as before.

**Verify Analyze / Claude (manual):**

1. Open DevTools → **Network**, filter by `analyze-website`.
2. Click **Analyze Website** on the home page.
3. Inspect the JSON response: `ok`, `source`, `claudeAttempted`, `websiteFetch` (`status`, optional `reason`, `finalUrl`, counts), `durationMs`, and `reason` (on failures). With a key and a good model response you should see `ok: true`, `source: "claude"`, `claudeAttempted: true`.
4. Read the **status line** under the button (e.g. “Claude extraction used.” vs “Using mocked extraction: …”).
5. With `npm run dev`, check the **server terminal** for `[analyze-website]` lines (development only): `hasApiKey`, `model`, outcome — never the secret key.

### Project progress and work log

- **Roadmap / stages:** [http://localhost:3000/progress](http://localhost:3000/progress) (includes **Stage 8 — Optional Claude-backed Analyze Website** when the dev server is running).
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
