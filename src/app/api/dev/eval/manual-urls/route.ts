import { NextResponse } from "next/server";
import { isEvalViewerEnabled } from "@/lib/evalLocal/isEvalViewerEnabled";
import { runManualUrlBatch } from "@/lib/evalLocal/runManualUrlBatch";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ManualUrlsBody = {
  urls?: string;
  projectTitle?: string;
};

export async function POST(request: Request) {
  if (!isEvalViewerEnabled()) {
    return NextResponse.json({ error: "Not available in production." }, { status: 403 });
  }

  let body: ManualUrlsBody;
  try {
    body = (await request.json()) as ManualUrlsBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const urlsText = typeof body.urls === "string" ? body.urls : "";
  if (!urlsText.trim()) {
    return NextResponse.json({ error: "Enter at least one URL." }, { status: 400 });
  }

  const urlLines = urlsText.split(/\r?\n/);
  const projectTitle =
    typeof body.projectTitle === "string" ? body.projectTitle : undefined;

  try {
    const result = await runManualUrlBatch({ urlLines, projectTitle });

    if (!result.runId) {
      return NextResponse.json({
        ok: false,
        error: "No valid URLs to process.",
        ...result,
      });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
