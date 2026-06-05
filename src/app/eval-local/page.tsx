import { redirect } from "next/navigation";

/** Alias for /dev/eval (local-only historical eval viewer). */
export default function EvalLocalAliasPage() {
  redirect("/dev/eval");
}
