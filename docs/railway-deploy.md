# Railway deployment (main)

Railway on **`main`** uses the repo **`Dockerfile`** (see `railway.toml`), not a full Nixpacks node_modules image. That keeps build and runtime disk use lower.

## Required variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude Analyze Website (optional for mock fallback) |
| `ANTHROPIC_MODEL` | Optional model override |

## Build fails: out of disk space

If the log shows disk exhaustion **before** `npm install` / `COPY` (no project output), the failure is on Railway’s build host, not your source tree.

1. **Redeploy** and **Clear build cache** (service → Settings).
2. One-time variable: `NO_CACHE=1` or `NIXPACKS_NO_CACHE=1`, deploy, then remove it.
3. Confirm the service uses **Dockerfile** builder (Settings → Build) after this repo’s `railway.toml` is on `main`.
4. If **staging** deploys but **production** does not on the **same commit**, compare services: production may need a **new Railway service** linked to `main`, or Railway support to reset the environment volume.
5. **Fallback:** Vercel on branch `vercel-deploy` — see [`vercel-deploy.md`](vercel-deploy.md).

## Local Docker smoke test

```bash
docker build -t expoprint-prototype .
docker run --rm -p 3000:3000 -e ANTHROPIC_API_KEY=dummy expoprint-prototype
```

Open http://localhost:3000 — Analyze will mock without a real key.
