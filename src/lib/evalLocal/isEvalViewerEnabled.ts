/** Local eval viewer must never read partner files in production builds. */
export function isEvalViewerEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}
