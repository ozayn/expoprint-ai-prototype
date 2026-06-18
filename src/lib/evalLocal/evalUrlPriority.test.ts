import assert from "node:assert/strict";
import {
  classifyUrlPathType,
  compareUrlPriority,
  isRootUrl,
  urlPriorityScore,
} from "./evalUrlPriority.js";

function testRootBeforePage() {
  const root = "https://example.com";
  const page = "https://example.com/page";
  assert.ok(urlPriorityScore(root) < urlPriorityScore(page));
  assert.ok(compareUrlPriority(root, page, 0, 1) < 0);
}

function testRootSlashBeforeDeep() {
  const rootSlash = "https://example.com/";
  const deep = "https://example.com/file/path?x=1";
  assert.equal(classifyUrlPathType(rootSlash), "root");
  assert.equal(classifyUrlPathType(deep), "deep");
  assert.ok(urlPriorityScore(rootSlash) < urlPriorityScore(deep));
}

function testQueryDeprioritized() {
  const root = "https://example.com";
  const withQuery = "https://example.com/?ref=1";
  assert.equal(classifyUrlPathType(withQuery), "deep");
  assert.ok(urlPriorityScore(root) < urlPriorityScore(withQuery));
}

function testShallowPath() {
  assert.equal(classifyUrlPathType("https://example.com/about"), "shallow");
  assert.equal(classifyUrlPathType("https://example.com/about/team"), "deep");
}

function testIsRootUrl() {
  assert.equal(isRootUrl("https://www.example.com/"), true);
  assert.equal(isRootUrl("https://example.com/contact"), false);
}

testRootBeforePage();
testRootSlashBeforeDeep();
testQueryDeprioritized();
testShallowPath();
testIsRootUrl();
console.log("evalUrlPriority.test.ts: all checks passed");
