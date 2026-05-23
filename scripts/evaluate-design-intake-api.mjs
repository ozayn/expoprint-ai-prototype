#!/usr/bin/env node
/**
 * Ground-truth evaluation for POST /api/design-intake/extract.
 * Usage:
 *   npm run api:evaluate
 *   npm run api:evaluate -- --verbose
 *   npm run api:evaluate -- --runs 3
 * Requires local dev server (default http://localhost:3000).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const FIXTURES_PATH = join(ROOT, "data/extraction-eval-fixtures.json");

const BASE_URL = (
  process.env.DESIGN_INTAKE_API_URL ?? "http://localhost:3000"
).replace(/\/$/, "");
const EXTRACT_URL = `${BASE_URL}/api/design-intake/extract`;
const VERBOSE = process.argv.includes("--verbose");

/** @typedef {"required" | "nice_to_have"} CheckSeverity */

/**
 * @typedef {object} ExpectedCheck
 * @property {string} type
 * @property {string} path
 * @property {CheckSeverity} [severity]
 * @property {unknown} [expected]
 * @property {string} [substring]
 * @property {string[]} [substrings]
 * @property {string[]} [paths]
 * @property {number} [min]
 */

/** @param {ExpectedCheck} check */
function checkPathLabel(check) {
  if (Array.isArray(check.paths) && check.paths.length > 0) {
    return check.paths.join(" | ");
  }
  return check.path ?? "(no path)";
}

/**
 * @typedef {object} Fixture
 * @property {string} name
 * @property {string} websiteUrl
 * @property {string} [productCategory]
 * @property {string[]} [components]
 * @property {string} [stylePreference]
 * @property {string} [customerInstructions]
 * @property {ExpectedCheck[]} expectedChecks
 */

function parseRuns(argv) {
  const idx = argv.indexOf("--runs");
  if (idx === -1) return 1;
  const raw = argv[idx + 1];
  const n = parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 10);
}

const RUN_COUNT = parseRuns(process.argv);

function getByPath(obj, path) {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cur = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

function formatValue(value) {
  if (value === undefined) return "(missing)";
  if (typeof value === "string") {
    return value.length > 120 ? `${value.slice(0, 117)}…` : JSON.stringify(value);
  }
  try {
    const s = JSON.stringify(value);
    return s.length > 160 ? `${s.slice(0, 157)}…` : s;
  } catch {
    return String(value);
  }
}

function valuesEqual(a, b) {
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return a === b;
}

/**
 * @param {unknown} response
 * @param {ExpectedCheck} check
 */
function runCheck(response, check) {
  const severity = check.severity === "nice_to_have" ? "nice_to_have" : "required";
  const actual =
    typeof check.path === "string" && check.path.length > 0
      ? getByPath(response, check.path)
      : undefined;

  switch (check.type) {
    case "exact": {
      const pass = valuesEqual(actual, check.expected);
      return {
        pass,
        message: pass
          ? "match"
          : `expected ${formatValue(check.expected)}, got ${formatValue(actual)}`,
        severity,
        actual,
        expected: check.expected,
      };
    }
    case "pathIncludes": {
      const sub = check.substring ?? "";
      const hay = typeof actual === "string" ? actual : String(actual ?? "");
      const pass =
        hay.length > 0 && hay.toLowerCase().includes(sub.toLowerCase());
      return {
        pass,
        message: pass
          ? "substring found"
          : `expected path to include ${JSON.stringify(sub)}, got ${formatValue(actual)}`,
        severity,
        actual,
        expected: sub,
      };
    }
    case "pathNotIncludes": {
      const sub = check.substring ?? "";
      const hay = typeof actual === "string" ? actual : String(actual ?? "");
      const pass =
        hay.length === 0 || !hay.toLowerCase().includes(sub.toLowerCase());
      return {
        pass,
        message: pass
          ? "substring absent"
          : `expected path not to include ${JSON.stringify(sub)}, got ${formatValue(actual)}`,
        severity,
        actual,
        expected: `not ${sub}`,
      };
    }
    case "arrayIncludes": {
      const sub = check.substring ?? "";
      const arr = Array.isArray(actual) ? actual : [];
      const pass = arr.some((item) => {
        const s = typeof item === "string" ? item : JSON.stringify(item);
        return s.toLowerCase().includes(sub.toLowerCase());
      });
      return {
        pass,
        message: pass
          ? "array includes substring"
          : `expected array to include ${JSON.stringify(sub)}, got ${formatValue(actual)}`,
        severity,
        actual,
        expected: sub,
      };
    }
    case "anyArrayIncludes": {
      const paths = Array.isArray(check.paths) ? check.paths : [];
      const needles = [
        ...(check.substring ? [check.substring] : []),
        ...(Array.isArray(check.substrings) ? check.substrings : []),
      ];
      let matchedPath = "";
      let matchedNeedle = "";
      let pass = false;
      for (const p of paths) {
        const value = getByPath(response, p);
        const arr = Array.isArray(value) ? value : [];
        for (const sub of needles) {
          if (
            arr.some((item) => {
              const s = typeof item === "string" ? item : JSON.stringify(item);
              return s.toLowerCase().includes(sub.toLowerCase());
            })
          ) {
            pass = true;
            matchedPath = p;
            matchedNeedle = sub;
            break;
          }
        }
        if (pass) break;
      }
      const expectedLabel =
        needles.length === 1
          ? needles[0]
          : `any of ${needles.map((n) => JSON.stringify(n)).join(", ")}`;
      return {
        pass,
        message: pass
          ? `${matchedPath} includes ${JSON.stringify(matchedNeedle)}`
          : `expected ${paths.join(" or ")} to include ${expectedLabel}, none matched`,
        severity,
        actual: pass ? matchedNeedle : undefined,
        expected: needles,
      };
    }
    case "exists": {
      const pass =
        actual !== undefined &&
        actual !== null &&
        !(typeof actual === "string" && actual.trim() === "");
      return {
        pass,
        message: pass ? "value present" : "expected value to exist",
        severity,
        actual,
        expected: "(exists)",
      };
    }
    case "countGte": {
      const min = check.min ?? 0;
      let count = 0;
      if (Array.isArray(actual)) count = actual.length;
      else if (typeof actual === "number" && Number.isFinite(actual)) {
        count = actual;
      }
      const pass = count >= min;
      return {
        pass,
        message: pass
          ? `count ${count} >= ${min}`
          : `expected count >= ${min}, got ${formatValue(actual)} (${count})`,
        severity,
        actual: count,
        expected: min,
      };
    }
    case "logoCandidateSource":
    case "typographyStyleGuess": {
      const pass = actual === check.expected;
      return {
        pass,
        message: pass
          ? "match"
          : `expected ${formatValue(check.expected)}, got ${formatValue(actual)}`,
        severity,
        actual,
        expected: check.expected,
      };
    }
    case "pathIn": {
      const allowed = Array.isArray(check.expected) ? check.expected : [];
      const pass =
        typeof actual === "string" &&
        allowed.some((v) => v === actual);
      return {
        pass,
        message: pass
          ? "value in allowed set"
          : `expected one of ${formatValue(allowed)}, got ${formatValue(actual)}`,
        severity,
        actual,
        expected: allowed,
      };
    }
    default:
      return {
        pass: false,
        message: `unknown check type: ${check.type}`,
        severity,
        actual,
        expected: check.expected,
      };
  }
}

/**
 * @param {Fixture} fixture
 */
async function fetchFixtureOnce(fixture) {
  const body = {
    websiteUrl: fixture.websiteUrl,
  };
  if (fixture.productCategory) body.productCategory = fixture.productCategory;
  if (fixture.components?.length) body.components = fixture.components;
  if (fixture.stylePreference) body.stylePreference = fixture.stylePreference;
  if (fixture.customerInstructions) {
    body.customerInstructions = fixture.customerInstructions;
  }

  let response;
  let httpStatus = 0;
  let fetchError = null;

  try {
    const res = await fetch(EXTRACT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    httpStatus = res.status;
    response = await res.json();
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
    response = { ok: false, reason: fetchError };
  }

  return { response, httpStatus, fetchError };
}

/**
 * @param {Fixture} fixture
 */
async function evaluateFixture(fixture) {
  /** @type {Awaited<ReturnType<typeof fetchFixtureOnce>>[]} */
  const runs = [];

  for (let i = 0; i < RUN_COUNT; i += 1) {
    runs.push(await fetchFixtureOnce(fixture));
  }

  const first = runs[0];
  const checks = fixture.expectedChecks ?? [];

  /** @type {{ check: ExpectedCheck, runResults: ReturnType<typeof runCheck>[], passCount: number }[]} */
  const aggregated = checks.map((check) => {
    const runResults = runs.map((r) => runCheck(r.response, check));
    const passCount = runResults.filter((rr) => rr.pass).length;
    return { check, runResults, passCount };
  });

  const requiredFails = aggregated.filter(
    (a) => a.check.severity !== "nice_to_have" && a.passCount === 0,
  );
  const requiredFlaky = aggregated.filter(
    (a) =>
      a.check.severity !== "nice_to_have" &&
      a.passCount > 0 &&
      a.passCount < RUN_COUNT,
  );
  const niceFails = aggregated.filter(
    (a) =>
      a.check.severity === "nice_to_have" &&
      a.passCount < RUN_COUNT,
  );

  const requiredTotal = aggregated.filter(
    (a) => a.check.severity !== "nice_to_have",
  ).length;
  const requiredPassAllRuns = aggregated.filter(
    (a) =>
      a.check.severity !== "nice_to_have" && a.passCount === RUN_COUNT,
  ).length;

  const anyFetchError = runs.some((r) => r.fetchError);
  const allHttpOk = runs.every((r) => r.httpStatus === 200);

  const passed =
    !anyFetchError &&
    allHttpOk &&
    requiredFails.length === 0 &&
    requiredFlaky.length === 0;

  return {
    fixture,
    runs,
    aggregated,
    requiredFails,
    requiredFlaky,
    niceFails,
    requiredPassAllRuns,
    requiredTotal,
    passed,
    firstResponse: first.response,
  };
}

function loadFixtures() {
  const raw = readFileSync(FIXTURES_PATH, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data.fixtures)) {
    throw new Error("fixtures file must contain a fixtures array");
  }
  return /** @type {Fixture[]} */ (data.fixtures);
}

function printRunConsistency(report) {
  if (RUN_COUNT <= 1) return;

  const names = report.runs.map(
    (r) => getByPath(r.response, "business.name") ?? "",
  );
  const uniqueNames = [...new Set(names.map((n) => String(n)))];
  const logos = report.runs.map(
    (r) => getByPath(r.response, "brand.logoCandidates[0].source") ?? "",
  );
  const uniqueLogoSources = [...new Set(logos.map((s) => String(s)))];

  console.log(`  Consistency (${RUN_COUNT} runs):`);
  console.log(
    `    business.name: ${uniqueNames.length === 1 ? "stable" : "varied"} — ${uniqueNames.map((n) => JSON.stringify(n)).join(", ")}`,
  );
  console.log(
    `    top logo source: ${uniqueLogoSources.length === 1 ? "stable" : "varied"} — ${uniqueLogoSources.map((s) => JSON.stringify(s)).join(", ")}`,
  );

  for (const row of report.aggregated) {
    if (row.passCount > 0 && row.passCount < RUN_COUNT) {
      const tag =
        row.check.severity === "nice_to_have" ? "nice_to_have" : "required";
      console.log(
        `    flaky [${tag}] ${row.check.type} ${checkPathLabel(row.check)}: ${row.passCount}/${RUN_COUNT} runs passed`,
      );
    }
  }
}

async function main() {
  console.log(`Design-intake extraction evaluation`);
  console.log(`POST ${EXTRACT_URL}`);
  console.log(`Fixtures: ${FIXTURES_PATH}`);
  if (RUN_COUNT > 1) {
    console.log(`Runs per fixture: ${RUN_COUNT}`);
  }
  console.log("");

  let fixtures;
  try {
    fixtures = loadFixtures();
  } catch (err) {
    console.error(`Failed to load fixtures: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  /** @type {Awaited<ReturnType<typeof evaluateFixture>>[]} */
  const reports = [];

  for (const fixture of fixtures) {
    console.log(`— ${fixture.name} (${fixture.websiteUrl})`);
    const report = await evaluateFixture(fixture);
    reports.push(report);

    const fetchErr = report.runs.find((r) => r.fetchError);
    if (fetchErr?.fetchError) {
      console.log(`  ✗ request failed: ${fetchErr.fetchError}`);
      console.log(`    Is the dev server running at ${BASE_URL}?`);
      continue;
    }

    for (const row of report.aggregated) {
      const lastRun = row.runResults[row.runResults.length - 1];
      const icon =
        row.passCount === RUN_COUNT
          ? "✓"
          : row.check.severity === "required"
            ? "✗"
            : "⚠";
      const tag =
        row.check.severity === "nice_to_have" ? "nice_to_have" : "required";
      const runNote =
        RUN_COUNT > 1 ? ` (${row.passCount}/${RUN_COUNT} runs)` : "";
      console.log(
        `  ${icon} [${tag}] ${row.check.type} ${checkPathLabel(row.check)} — ${lastRun.message}${runNote}`,
      );
      if (
        RUN_COUNT === 1 &&
        !lastRun.pass &&
        lastRun.expected !== undefined
      ) {
        console.log(
          `      expected: ${formatValue(lastRun.expected)}  actual: ${formatValue(lastRun.actual)}`,
        );
      }
    }

    console.log(
      `  ${report.passed ? "PASS" : "FAIL"} — required stable ${report.requiredPassAllRuns}/${report.requiredTotal}`,
    );
    if (report.niceFails.length > 0) {
      console.log(
        `  warnings: ${report.niceFails.length} nice_to_have check(s) not stable across runs`,
      );
    }

    printRunConsistency(report);

    if (VERBOSE) {
      for (let i = 0; i < report.runs.length; i += 1) {
        console.log(`  — run ${i + 1} response —`);
        console.log(JSON.stringify(report.runs[i].response, null, 2));
      }
    }
    console.log("");
  }

  const anyFail = reports.some((r) => !r.passed);
  const totalRequiredStable = reports.reduce(
    (n, r) => n + r.requiredPassAllRuns,
    0,
  );
  const totalRequired = reports.reduce((n, r) => n + r.requiredTotal, 0);

  console.log("Summary");
  console.log(
    `  Fixtures: ${reports.filter((r) => r.passed).length}/${reports.length} passed`,
  );
  console.log(
    `  Required checks stable across runs: ${totalRequiredStable}/${totalRequired}`,
  );
  if (RUN_COUNT > 1) {
    console.log(`  (${RUN_COUNT} runs per fixture)`);
  }

  if (anyFail) {
    console.log("\nEvaluation failed (required failures or flaky checks).");
    process.exit(1);
  }
  console.log("\nAll required checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
