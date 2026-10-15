import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteFound } from "../lib/verify.js";
import { suggest } from "../lib/rubric.js";

const cv = `- Built the call-quality evaluation pipeline used to grade 40,000 calls a week; replaced a manual QA sample of 2% of calls.
Mentored two junior analysts; wrote our internal guide to sequential testing.`;

test("exact quote is found", () => {
  assert.ok(quoteFound("grade 40,000 calls a week", cv));
});

test("case, whitespace and curly quotes are ignored", () => {
  assert.ok(quoteFound("Built the call-quality   evaluation pipeline", cv));
  assert.ok(quoteFound("“Mentored two junior analysts”", cv));
});

test("ellipsis fragments must appear in order", () => {
  assert.ok(quoteFound("Built the call-quality evaluation pipeline ... replaced a manual QA sample", cv));
  assert.ok(!quoteFound("replaced a manual QA sample ... Built the call-quality", cv));
});

test("invented or paraphrased quotes are rejected", () => {
  assert.ok(!quoteFound("graded 40,000 calls per week", cv));
  assert.ok(!quoteFound("led a team of five", cv));
  assert.ok(!quoteFound("...", cv));
});

const ids = ["production", "stats"];
const s = (pairs) => pairs.map(([axis_id, score]) => ({ axis_id, score }));

test("a must-have at 2 or below suggests decline", () => {
  const r = suggest(s([["intelligence", 5], ["communication", 5], ["team_player", 5], ["production", 2], ["stats", 5]]), ids);
  assert.equal(r.decision, "decline");
});

test("high scores everywhere suggest advance", () => {
  const r = suggest(s([["intelligence", 4], ["communication", 4], ["team_player", 4], ["production", 4], ["stats", 4]]), ids);
  assert.equal(r.decision, "advance");
});

test("middling scores go to a human", () => {
  const r = suggest(s([["intelligence", 3], ["communication", 4], ["team_player", 4], ["production", 3], ["stats", 3]]), ids);
  assert.equal(r.decision, "human_review");
});
