import { redirect } from "next/navigation";
import { EVAL_VIEWER_BASE_PATH } from "@/lib/evalLocal/loadLocalEvalViewerDataset";

/** Alias for the canonical eval viewer at `/internal/eval`. */
export default function EvalLocalAliasPage() {
  redirect(EVAL_VIEWER_BASE_PATH);
}
