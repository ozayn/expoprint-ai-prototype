/**
 * Shown only when the app runs on Vercel (`VERCEL=1`). Railway and local dev
 * do not set these variables, so production Railway stays unchanged.
 *
 * Uses Vercel system env:
 * https://vercel.com/docs/projects/environment-variables/system-environment-variables
 */
export function DeployPlatformBadge() {
  if (process.env.VERCEL !== "1") {
    return null;
  }

  const branch = process.env.VERCEL_GIT_COMMIT_REF?.trim() || "unknown";
  const vercelEnv = process.env.VERCEL_ENV?.trim() || "unknown";
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.trim().slice(0, 7);

  return (
    <div
      className="w-full rounded-md border border-violet-200 bg-violet-50/90 px-3 py-2 text-xs leading-snug text-violet-950 sm:w-auto"
      role="status"
      aria-label={`Deployed on Vercel, branch ${branch}`}
    >
      <p className="font-medium">
        Deployed on{" "}
        <span className="font-semibold text-violet-900">Vercel</span>
        {vercelEnv !== "unknown" ? (
          <span className="font-normal text-violet-800/90"> · {vercelEnv}</span>
        ) : null}
      </p>
      <p className="mt-0.5 font-mono text-[11px] text-violet-900/85">
        Git branch: <span className="font-semibold">{branch}</span>
        {sha ? <span className="text-violet-800/75"> · {sha}</span> : null}
      </p>
      <p className="mt-1 text-[11px] text-violet-800/80">
        Confirm this matches the branch you configured in the Vercel project
        (e.g. <span className="font-mono">vercel-deploy</span> for prototype
        tests).
      </p>
    </div>
  );
}
