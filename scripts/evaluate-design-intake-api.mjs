#!/usr/bin/env node
/**
 * Ground-truth evaluation for POST /api/design-intake/extract.
 * Usage: npm run api:evaluate [-- --verbose]
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
 * @property {number} [min]
 */

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
  const actual = getByPath(response, check.path);
  const severity = check.severity === "nice_to_have" ? "nice_to_have" : "required";

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
async function evaluateFixture(fixture) {
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

  /** @type {{ check: ExpectedCheck, result: ReturnType<typeof runCheck> }[]} */
  const results = (fixture.expectedChecks ?? []).map((check) => ({
    check,
    result: runCheck(response, check),
  }));

  const requiredFails = results.filter(
    (r) => !r.result.pass && r.result.severity === "required",
  );
  const niceFails = results.filter(
    (r) => !r.result.pass && r.result.severity === "nice_to_have",
  );
  const requiredPass = results.filter(
    (r) => r.result.pass && r.result.severity === "required",
  ).length;
  const requiredTotal = results.filter(
    (r) => r.result.severity === "required",
  ).length;

  return {
    fixture,
    body,
    response,
    httpStatus,
    fetchError,
    results,
    requiredFails,
    niceFails,
    requiredPass,
    requiredTotal,
    passed: requiredFails.length === 0 && !fetchError && httpStatus === 200,
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

async function main() {
  console.log(`Design-intake extraction evaluation`);
  console.log(`POST ${EXTRACT_URL}`);
  console.log(`Fixtures: ${FIXTURES_PATH}\n`);

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

    if (report.fetchError) {
      console.log(`  ✗ request failed: ${report.fetchError}`);
      console.log(`    Is the dev server running at ${BASE_URL}?`);
      continue;
    }
    if (report.httpStatus !== 200) {
      console.log(`  ✗ HTTP ${report.httpStatus}`);
    }

    for (const { check, result } of report.results) {
      const icon = result.pass ? "✓" : result.severity === "required" ? "✗" : "⚠";
      const tag =
        result.severity === "nice_to_have" ? "nice_to_have" : "required";
      console.log(
        `  ${icon} [${tag}] ${check.type} ${check.path} — ${result.message}`,
      );
    }

    console.log(
      `  ${report.passed ? "PASS" : "FAIL"} — required ${report.requiredPass}/${report.requiredTotal}`,
    );
    if (report.niceFails.length > 0) {
      console.log(`  warnings: ${report.niceFails.length} nice_to_have check(s) failed`);
    }
    if (VERBOSE) {
      console.log(JSON.stringify(report.response, null, 2));
    }
    console.log("");
  }

  const anyRequiredFail = reports.some((r) => !r.passed);
  const totalRequiredPass = reports.reduce((n, r) => n + r.requiredPass, 0);
  const totalRequired = reports.reduce((n, r) => n + r.requiredTotal, 0);
  const totalNiceWarn = reports.reduce((n, r) => n + r.niceFails.length, 0);

  console.log("Summary");
  console.log(
    `  Fixtures: ${reports.filter((r) => r.passed).length}/${reports.length} passed (required checks)`,
  );
  console.log(`  Required checks: ${totalRequiredPass}/${totalRequired}`);
  if (totalNiceWarn > 0) {
    console.log(`  Nice-to-have warnings: ${totalNiceWarn}`);
  }

  if (anyRequiredFail) {
    console.log("\nEvaluation failed (required check failures).");
    process.exit(1);
  }
  console.log("\nAll required checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
