import type { NextConfig } from "next";

/**
 * Allows Next.js + Fabric.js to run under a default CSP without console errors
 * for `eval` (some bundles / dev tooling). Tighten further with nonces when
 * moving beyond this prototype.
 */
/**
 * On Vercel (`VERCEL=1`), omit localhost WebSocket hosts from CSP — they are only
 * needed for `next dev` HMR. Railway and local dev keep the broader connect-src.
 */
const connectSrc =
  process.env.VERCEL === "1"
    ? "'self'"
    : "'self' ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  /**
   * Logo candidate previews load remote favicons / og:images from arbitrary
   * customer sites. Limit to `https:` so http:// origins remain blocked.
   */
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  `connect-src ${connectSrc}`,
].join("; ");

const nextConfig: NextConfig = {
  /** Fabric’s optional `canvas` native dep — keep off the server bundle (Railway/Vercel). */
  serverExternalPackages: ["canvas", "jsdom"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
