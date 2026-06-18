import Link from "next/link";

export const devEvalNavLinkClassName =
  "inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400";

type DevEvalNavLinkProps = {
  className?: string;
  children?: string;
};

/** Local development only — omitted from production builds and deployments. */
export function DevEvalNavLink({
  className = devEvalNavLinkClassName,
  children = "Eval viewer",
}: DevEvalNavLinkProps) {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <Link href="/internal/eval" className={className}>
      {children}
    </Link>
  );
}

/** Deployed password-protected brand audit viewer (sanitized sample or published JSON). */
export function InternalEvalNavLink({
  className = devEvalNavLinkClassName,
  children = "Internal eval",
}: DevEvalNavLinkProps) {
  if (process.env.NODE_ENV === "development") {
    return null;
  }

  return (
    <Link href="/internal/eval" className={className}>
      {children}
    </Link>
  );
}
