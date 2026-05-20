# Vercel deployment (prototype branch)

This guide applies to the **`vercel-deploy`** branch only. **`main`** stays configured for the existing **Railway** deployment — do not point production Railway at this branch until you intentionally migrate.

## Why a separate branch?

- Railway and Vercel both run the same Next.js app, but serverless limits (duration, cold starts, env wiring) differ.
- Vercel-specific `vercel.json` and API `maxDuration` settings live here so **`main` / Railway** are unaffected.

## Deploy steps

1. Push branch: `git push -u origin vercel-deploy` (already done when this doc was added).
2. In [Vercel](https://vercel.com/new), **Import** the GitHub repo `ozayn/expoprint-ai-prototype`.
3. Set **Production Branch** (or Preview only) to **`vercel-deploy`** — not `main`, if you want Railway to keep serving production from `main`.
4. Framework preset: **Next.js** (auto-detected).
5. **Environment variables** (Project → Settings → Environment Variables):

   | Name | Required | Notes |
   |------|----------|--------|
   | `ANTHROPIC_API_KEY` | For Claude analyze | Same as Railway; never commit the value |
   | `ANTHROPIC_MODEL` | Optional | e.g. `claude-3-5-sonnet-latest` |

6. Deploy. Smoke-test:
   - `/` — canvas + Analyze Website
   - `/demo` — guided flow
   - `/api/analyze-website` — via UI (Network tab)
   - Logo candidate → Generate concept → proxied image via `/api/proxy-image`

## Serverless notes

- **`POST /api/analyze-website`** — homepage + up to 3 extra page fetches + Claude. `maxDuration` is **60s** on this branch (`vercel.json` + route export). On **Hobby**, Vercel may still cap at **10s**; use **Pro** or expect mock fallback if analyze times out.
- **`GET /api/proxy-image`** — bounded fetch (~6s internal) + 2 MiB cap; `maxDuration` **15s**.
- Both routes use **`export const runtime = "nodejs"`** (DNS + streaming body limits).

## Railway (unchanged)

- No `vercel.json` on `main`.
- Continue setting variables in Railway **Variables** tab per [README](../README.md).
- `npm run build` + `npm start` (or Railway’s detected start command) remains the Railway path.

## Local parity

```bash
git checkout vercel-deploy
npm ci
npm run build
npm start
```

`vercel dev` is optional if you install the [Vercel CLI](https://vercel.com/docs/cli).
