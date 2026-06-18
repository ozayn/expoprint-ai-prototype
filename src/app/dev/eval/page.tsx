import { redirect } from "next/navigation";
import {
  buildEvalViewerHref,
  type EvalViewerQueryParams,
} from "@/lib/evalLocal/evalViewerQuery";
import { EVAL_VIEWER_BASE_PATH } from "@/lib/evalLocal/loadLocalEvalViewerDataset";

type PageProps = {
  searchParams: Promise<EvalViewerQueryParams>;
};

/** Legacy route — canonical eval viewer is `/internal/eval`. */
export default async function DevEvalRedirectPage({ searchParams }: PageProps) {
  const params = await searchParams;
  redirect(buildEvalViewerHref(EVAL_VIEWER_BASE_PATH, params));
}
