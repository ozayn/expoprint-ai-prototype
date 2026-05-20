# Vercel deployment (`main`)

The prototype **deploys on Vercel from the `main` branch** only. Railway is no longer used for this project.

## Deploy steps

1. In [Vercel](https://vercel.com/new), **Import** the GitHub repo `ozayn/expoprint-ai-prototype` (or open the existing project).
2. Set **Production Branch** to **`main`**.
3. Framework preset: **Next.js** (auto-detected). Build uses `vercel.json` (`npm run build`).
4. **Environment variables** (Project → Settings → Environment Variables):

   | Name | Required | Notes |
   |------|----------|--------|
   | `ANTHROPIC_API_KEY` | For Claude analyze | Never commit the value |
   | `ANTHROPIC_MODEL` | Optional | e.g. `claude-sonnet-4-20250514` |

5. Deploy. Smoke-test:
   - `/` — canvas + Analyze Website
   - `/demo` — guided flow
   - `/progress` — roadmap (includes deployment status)

When `VERCEL=1`, the home page shows **Deployed on Vercel** with the git branch and short SHA (`DeployPlatformBadge`).

## Config in the repo

- `vercel.json` — build command and API `maxDuration` for `/api/analyze-website` (60s) and `/api/proxy-image` (15s)
- `next.config.ts` — tighter `connect-src` when `VERCEL=1` (no localhost HMR hosts)

## Local vs Vercel

Copy `.env.example` → `.env.local` for local dev. Use the same variable names in the Vercel project for production.
