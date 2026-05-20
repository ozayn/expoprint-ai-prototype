# Railway deployment (main)

Railway on **`main`** uses **Railpack** with `scripts/railway-build.sh` (see `railway.toml`): `next build` (standalone), copy `public` + `.next/static` into the standalone bundle, prune dev deps. **Start command:** `node .next/standalone/server.js` (not `next start` — incompatible with `output: "standalone"`).

Optional manual Docker build: `docker/Dockerfile` (not auto-detected at repo root).

## Required variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude Analyze Website (optional for mock fallback) |
| `ANTHROPIC_MODEL` | Optional model override |

## Railway builder disk-space failures

If a deployment fails **before** `npm install`, `npm ci`, `COPY`, or your build scripts run, and logs show **`no space left on device`**, treat it as **Railway builder infrastructure**, not an app build failure. Changing Node version, Dockerfile, or `railway-build.sh` will not fix a host that is already full.

A **redeploy** may help if Railway assigns a different builder, but **repeated failures** on the same service often mean a **saturated builder pool** or a bad environment — not a bug in your repo.

**Recommended actions:**

1. **Redeploy once** (quick retry in case the next builder has free disk).
2. **Clear build cache** and/or deploy once with **`NO_CACHE=1`** (or `NIXPACKS_NO_CACHE=1`), then remove that variable after a successful build.
3. **Open a Railway support ticket** with the **deploy ID** and the exact **`no space left on device`** log line; ask for environment reset or a healthy builder.
4. If urgent, **create a fresh Railway service** from the same repo/branch (`main`), copy **environment variables** (`ANTHROPIC_API_KEY`, etc.), and point DNS or share the new URL.
5. Use **staging Railway** or **Vercel** (`vercel-deploy`) for demos while production Railway is blocked — see [`vercel-deploy.md`](vercel-deploy.md).

**Same commit, staging works:** If staging deploys successfully while production fails with disk errors before install, the **code and config are likely fine**; focus on the production service, builder pool, or Railway support — not more app changes.

For normal app-level build failures (after install/build starts), confirm **Railpack** and `bash scripts/railway-build.sh` in Settings → Build (`railway.toml` on `main`).

## Local Docker smoke test

```bash
docker build -t expoprint-prototype .
docker run --rm -p 3000:3000 -e ANTHROPIC_API_KEY=dummy expoprint-prototype
```

Open http://localhost:3000 — Analyze will mock without a real key.
