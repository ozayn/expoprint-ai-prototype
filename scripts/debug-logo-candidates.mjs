#!/usr/bin/env node
/**
 * Debug logo candidates for one website URL:
 * POST /api/design-intake/extract, then probe each candidate via /api/proxy-image.
 *
 * Usage:
 *   node scripts/debug-logo-candidates.mjs https://www.patagonia.com
 *   npm run api:logo-debug -- https://www.patagonia.com
 */
const BASE = process.env.API_BASE_URL ?? "http://localhost:3000";

function safePath(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return "(invalid url)";
  }
}

async function postExtract(websiteUrl) {
  const res = await fetch(`${BASE}/api/design-intake/extract`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      websiteUrl,
      productCategory: "Outdoor tent",
      components: ["Canopy tent"],
      stylePreference: "Modern",
    }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Extract response not JSON (HTTP ${res.status})`);
  }
  return { status: res.status, json };
}

async function probeProxy(candidateUrl) {
  const proxyUrl = `${BASE}/api/proxy-image?url=${encodeURIComponent(candidateUrl)}`;
  try {
    const res = await fetch(proxyUrl, { method: "GET" });
    const bodyText = await res.text();
    const snippet = bodyText.slice(0, 80).replace(/\s+/g, " ");
    return {
      proxyStatus: res.status,
      proxyAccepted: res.ok,
      proxyReason: res.ok ? "ok" : bodyText.trim().slice(0, 120),
      bodySnippet: res.ok ? `(image bytes, ${bodyText.length} chars)` : snippet,
    };
  } catch (err) {
    return {
      proxyStatus: 0,
      proxyAccepted: false,
      proxyReason: err instanceof Error ? err.message : "fetch_error",
      bodySnippet: "",
    };
  }
}

function printCandidate(row, index) {
  console.log(`\n— Candidate ${index + 1}`);
  console.log(`  path:           ${row.path}`);
  console.log(`  source:         ${row.source}`);
  console.log(`  logoRole:       ${row.logoRole ?? "(none)"}`);
  console.log(`  score:          ${row.score ?? "(none)"}`);
  console.log(`  transparency:   ${row.transparency ?? "(none)"}`);
  if (row.previewFetch) {
    console.log(`  server probe:   accepted=${row.previewFetch.accepted} type=${row.previewFetch.contentType ?? ""} reason=${row.previewFetch.reason ?? ""}`);
  }
  console.log(`  proxy:          ${row.proxyAccepted ? "accepted" : "rejected"} (HTTP ${row.proxyStatus})`);
  if (!row.proxyAccepted) {
    console.log(`  proxy reason:   ${row.proxyReason}`);
  } else {
    console.log(`  proxy body:     ${row.bodySnippet}`);
  }
}

async function main() {
  const websiteUrl = process.argv[2]?.trim();
  if (!websiteUrl) {
    console.error("Usage: node scripts/debug-logo-candidates.mjs <websiteUrl>");
    process.exit(1);
  }

  console.log(`Logo candidate debug`);
  console.log(`  extract: ${BASE}/api/design-intake/extract`);
  console.log(`  website: ${websiteUrl}`);

  const { status, json } = await postExtract(websiteUrl);
  console.log(`\nExtract HTTP ${status}, ok=${json.ok}`);

  const brandList = json.brand?.logoCandidates ?? [];
  const fetchList = json.metadata?.websiteFetch?.logoCandidatesList ?? [];
  const candidates = brandList.length > 0 ? brandList : fetchList;

  console.log(`\nbrand.logoCandidates: ${brandList.length}`);
  console.log(`metadata.websiteFetch.logoCandidatesList: ${fetchList.length}`);

  if (candidates.length === 0) {
    console.log("\nNo logo candidates returned.");
    process.exit(0);
  }

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const proxy = await probeProxy(c.url);
    printCandidate(
      {
        path: safePath(c.url),
        source: c.source,
        logoRole: c.logoRole,
        score: c.score,
        transparency: c.transparency,
        previewFetch: c.previewFetch,
        ...proxy,
      },
      i,
    );
  }

  const anyProxyOk = (
    await Promise.all(candidates.map((c) => probeProxy(c.url)))
  ).some((p) => p.proxyAccepted);

  console.log(`\nSummary`);
  console.log(`  candidates: ${candidates.length}`);
  console.log(`  any proxy-accepted image: ${anyProxyOk}`);
  console.log(`  canvas can render: ${anyProxyOk ? "yes (if user selects an accepted URL)" : "no — all candidates reject or fail preview"}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
